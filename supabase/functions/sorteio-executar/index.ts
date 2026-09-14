// Executa o sorteio e grava o resultado (append-only, RNF-06).
// Congela o snapshot antes de sortear e bloqueia re-execução (E-18).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { respostaJson, respostaCors } from '../_shared/ig.ts';
import { sortear } from '../_shared/sorteio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();

  try {
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: userData } = await supabaseAuth.auth.getUser();
    if (!userData?.user) return respostaJson({ error: 'não autenticado' }, 401);

    const { sorteio_id, seed_publica, seed_fonte } = await req.json();
    if (!sorteio_id || !seed_publica) {
      return respostaJson({ error: 'sorteio_id e seed_publica são obrigatórios' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: sorteio } = await admin
      .from('sorteio')
      .select('*, ig_account!inner(user_id)')
      .eq('id', sorteio_id)
      .single();
    if (!sorteio) return respostaJson({ error: 'sorteio não encontrado' }, 404);
    if ((sorteio.ig_account as { user_id: string }).user_id !== userData.user.id) {
      return respostaJson({ error: 'sem permissão' }, 403);
    }

    // E-18: uma execução por rodada
    const { data: jaExiste } = await admin
      .from('resultado')
      .select('id')
      .eq('sorteio_id', sorteio_id)
      .maybeSingle();
    if (jaExiste) {
      return respostaJson(
        { error: 'Este sorteio já foi executado. Crie uma nova rodada para o mesmo post.' },
        409
      );
    }

    // congela o snapshot: nenhuma importação depois disso
    await admin
      .from('sorteio')
      .update({ status: 'ENCERRADO', encerrado_em: new Date().toISOString() })
      .eq('id', sorteio_id);

    // lista de chances na ordem canônica
    const chances: Array<{ ordem: number; autor_username: string; ig_comment_id: string }> = [];
    const LOTE = 1000;
    for (let inicio = 0; ; inicio += LOTE) {
      const { data, error } = await admin
        .from('chance')
        .select('ordem, autor_username, comentario!inner(ig_comment_id)')
        .eq('sorteio_id', sorteio_id)
        .order('ordem', { ascending: true })
        .range(inicio, inicio + LOTE - 1);
      if (error) throw error;
      if (!data?.length) break;
      for (const c of data as unknown as Array<{
        ordem: number; autor_username: string; comentario: { ig_comment_id: string };
      }>) {
        chances.push({
          ordem: c.ordem,
          autor_username: c.autor_username,
          ig_comment_id: c.comentario.ig_comment_id,
        });
      }
      if (data.length < LOTE) break;
    }

    if (chances.length === 0) {
      return respostaJson({ error: 'Nenhum participante habilitado — sorteio bloqueado.' }, 409);
    }

    let r;
    try {
      r = await sortear(chances, seed_publica, sorteio.qtd_vencedores, sorteio.qtd_suplentes);
    } catch (e) {
      const codigo = e instanceof Error ? e.message : String(e);
      const mensagens: Record<string, string> = {
        SEM_PARTICIPANTES: 'Nenhum participante habilitado — sorteio bloqueado.',
        VENCEDORES_ACIMA_DE_PARTICIPANTES:
          'Você pediu mais ganhadores do que existem participantes distintos.',
      };
      return respostaJson({ error: mensagens[codigo] ?? codigo }, 409);
    }

    const [{ count: totalComentarios }, { count: totalHabilitados }] = await Promise.all([
      admin.from('comentario').select('*', { count: 'exact', head: true }).eq('sorteio_id', sorteio_id),
      admin
        .from('qualificacao')
        .select('*', { count: 'exact', head: true })
        .eq('sorteio_id', sorteio_id)
        .in('status', ['HABILITADO', 'SUSPEITO']),
    ]);

    const { data: resultado, error: insErr } = await admin
      .from('resultado')
      .insert({
        sorteio_id,
        seed_publica,
        seed_fonte: seed_fonte ?? 'Publicada antes da execução',
        hash_lista: r.hash_lista,
        total_comentarios: totalComentarios ?? 0,
        total_habilitados: totalHabilitados ?? 0,
        total_chances: r.total_chances,
        vencedores: r.vencedores,
        suplentes: r.suplentes,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    await admin
      .from('sorteio')
      .update({
        status: 'SORTEADO',
        seed_publica,
        seed_fonte: seed_fonte ?? 'Publicada antes da execução',
        hash_lista: r.hash_lista,
      })
      .eq('id', sorteio_id);

    return respostaJson({ ...resultado, seed_final: r.seed_final });
  } catch (err) {
    console.error('sorteio-executar:', err);
    const detalhe =
      err instanceof Error ? err.message
      : typeof err === 'object' && err !== null ? JSON.stringify(err)
      : String(err);
    return respostaJson({ error: detalhe }, 500);
  }
});
