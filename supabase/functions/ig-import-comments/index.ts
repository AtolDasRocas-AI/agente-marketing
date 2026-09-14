// Importa comentários em lotes, retomável por cursor (CAP-04, RNF-04, E-16).
// Achado da Onda 0: o autor vem em from{username}, não em username.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GRAPH, respostaJson, respostaCors } from '../_shared/ig.ts';

const MAX_PAGINAS_POR_INVOCACAO = 10; // ~500 comentários por chamada
const LIMITE_PAGINA = 50;

interface AutorApi {
  id: string;
  username: string;
}

interface RespostaApi {
  id: string;
  text?: string;
  timestamp: string;
  from?: AutorApi;
}

interface ComentarioApi {
  id: string;
  text?: string;
  timestamp: string;
  from?: AutorApi;
  replies?: { data?: RespostaApi[] };
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET com backoff exponencial em 429/5xx (RNF-04) */
async function buscarComRetry(url: string, maxTentativas = 5): Promise<Response> {
  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (res.status !== 429 && res.status < 500) return res; // erro definitivo
    await dormir(1000 * 2 ** tentativa); // 1s, 2s, 4s, 8s, 16s
  }
  throw new Error('Rate limit persistente após 5 tentativas.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Autenticação: JWT do organizador OU segredo do cron.
    // Sem isso a function ficaria aberta para qualquer um disparar imports.
    const segredoCron = Deno.env.get('CRON_SECRET');
    const viaCron = Boolean(segredoCron) && req.headers.get('x-cron-secret') === segredoCron;

    let userId: string | null = null;
    if (!viaCron) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
      );
      const { data: userData } = await supabaseAuth.auth.getUser();
      if (!userData?.user) return respostaJson({ error: 'não autenticado' }, 401);
      userId = userData.user.id;
    }

    const { sorteio_id } = await req.json();
    if (!sorteio_id) return respostaJson({ error: 'sorteio_id obrigatório' }, 400);

    const { data: sorteio } = await admin
      .from('sorteio')
      .select('id, ig_media_id, status, account_id, ig_account!inner(user_id)')
      .eq('id', sorteio_id)
      .single();
    if (!sorteio) return respostaJson({ error: 'sorteio não encontrado' }, 404);

    // dono do sorteio precisa ser quem chamou (quando não é o cron)
    if (userId && (sorteio.ig_account as { user_id: string }).user_id !== userId) {
      return respostaJson({ error: 'sem permissão' }, 403);
    }
    if (sorteio.status === 'ENCERRADO' || sorteio.status === 'SORTEADO') {
      return respostaJson({ error: 'Sorteio encerrado: snapshot congelado.' }, 409); // RNF-06
    }

    const { data: token } = await admin.rpc('ler_token_instagram', {
      p_account_id: sorteio.account_id,
    });
    if (!token) return respostaJson({ error: 'TOKEN_EXPIRADO', reconectar: true }, 401);

    // job retomável
    const { data: jobs } = await admin
      .from('import_job')
      .select('*')
      .eq('sorteio_id', sorteio_id)
      .order('atualizado_em', { ascending: false })
      .limit(1);
    let job = jobs?.[0];
    if (!job) {
      const { data: novo } = await admin
        .from('import_job')
        .insert({ sorteio_id, status: 'RODANDO' })
        .select()
        .single();
      job = novo!;
    } else {
      await admin
        .from('import_job')
        .update({ status: 'RODANDO', atualizado_em: new Date().toISOString() })
        .eq('id', job.id);
    }

    /* As respostas vêm juntas: o comments_count da API só conta o 1º
       nível, então elas são "extras" que só aparecem se pedirmos.
       Importamos sempre (is_reply=true) e a participação é decidida no
       motor de regras, pelo campo incluir_respostas do sorteio. */
    const campos =
      'id,text,timestamp,from{id,username},' +
      'replies.limit(50){id,text,timestamp,from{id,username}}';
    let url: string | null = job.cursor_after
      ? `${GRAPH}/${sorteio.ig_media_id}/comments?fields=${campos}&limit=${LIMITE_PAGINA}&after=${job.cursor_after}&access_token=${token}`
      : `${GRAPH}/${sorteio.ig_media_id}/comments?fields=${campos}&limit=${LIMITE_PAGINA}&access_token=${token}`;

    let importados = 0;
    let paginas = 0;
    let cursor: string | null = job.cursor_after ?? null;

    while (url && paginas < MAX_PAGINAS_POR_INVOCACAO) {
      const res = await buscarComRetry(url);
      const body = await res.json();
      if (!res.ok) {
        await admin
          .from('import_job')
          .update({
            status: 'ERRO',
            erro: JSON.stringify(body.error),
            tentativas: (job.tentativas ?? 0) + 1,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', job.id);
        return respostaJson({ error: `Graph API: ${JSON.stringify(body.error)}` }, 502);
      }

      const linhas: Array<{
        sorteio_id: string;
        ig_comment_id: string;
        autor_username: string | null;
        texto: string;
        publicado_em: string;
        is_reply: boolean;
      }> = [];

      for (const c of body.data as ComentarioApi[]) {
        linhas.push({
          sorteio_id,
          ig_comment_id: c.id,
          autor_username: c.from?.username ?? null, // null → E-13 na qualificação
          texto: c.text ?? '',
          publicado_em: c.timestamp,
          is_reply: false,
        });
        for (const r of c.replies?.data ?? []) {
          linhas.push({
            sorteio_id,
            ig_comment_id: r.id,
            autor_username: r.from?.username ?? null,
            texto: r.text ?? '',
            publicado_em: r.timestamp,
            is_reply: true,
          });
        }
        if ((c.replies?.data?.length ?? 0) >= 50) {
          console.warn(`comentário ${c.id} tem 50+ respostas — pode haver truncamento`);
        }
      }

      if (linhas.length) {
        // upsert garante idempotência na retomada (AC-05)
        const { error: upErr } = await admin
          .from('comentario')
          .upsert(linhas, { onConflict: 'sorteio_id,ig_comment_id', ignoreDuplicates: true });
        if (upErr) throw upErr;
        importados += linhas.length;
      }

      cursor = body.paging?.cursors?.after ?? cursor;
      url = body.paging?.next ?? null;
      paginas++;
    }

    const { count } = await admin
      .from('comentario')
      .select('*', { count: 'exact', head: true })
      .eq('sorteio_id', sorteio_id);

    const concluido = !url;
    await admin
      .from('import_job')
      .update({
        status: concluido ? 'CONCLUIDO' : 'PENDENTE', // PENDENTE → cron re-invoca
        cursor_after: concluido ? null : cursor,
        total_importado: count ?? 0,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (concluido) {
      await admin.from('sorteio').update({ status: 'PRONTO' }).eq('id', sorteio_id);
    }

    return respostaJson({
      job_id: job.id,
      paginas_nesta_invocacao: paginas,
      importados_nesta_invocacao: importados,
      total_no_banco: count ?? 0,
      concluido,
      proximo_cursor: concluido ? null : cursor,
    });
  } catch (err) {
    console.error('ig-import-comments:', err);
    const detalhe =
      err instanceof Error ? err.message
      : typeof err === 'object' && err !== null ? JSON.stringify(err)
      : String(err);
    return respostaJson({ error: detalhe }, 500);
  }
});
