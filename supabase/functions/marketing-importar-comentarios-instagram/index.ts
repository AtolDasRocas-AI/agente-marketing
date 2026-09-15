// Importação somente-leitura de comentários das publicações já conhecidas (Sprint C).
// Nunca responde comentários. Reaproveita paginação e log de execução da Onda 2.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GRAPH, respostaCors, respostaJson } from '../_shared/ig.ts';

const MAX_MEDIA_POR_INVOCACAO = 20;
const MAX_PAGINAS_POR_MEDIA = 5;
const LIMITE_PAGINA = 50;

interface ErroGraphApi { message?: string; code?: number }
type TipoErroImportacao = 'TOKEN_EXPIRADO' | 'PERMISSAO_AUSENTE' | 'LIMITE_META' | 'ERRO_DESCONHECIDO';

function mapearTipoErro(erro: ErroGraphApi | undefined): TipoErroImportacao {
  const codigo = erro?.code;
  if (codigo === 190) return 'TOKEN_EXPIRADO';
  if (codigo === 200 || codigo === 10) return 'PERMISSAO_AUSENTE';
  if (codigo === 4 || codigo === 17 || codigo === 32) return 'LIMITE_META';
  return 'ERRO_DESCONHECIDO';
}

interface ComentarioApi { id: string; text?: string; timestamp: string; from?: { username?: string } }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();
  if (req.method !== 'POST') return respostaJson({ codigo: 'METODO_NAO_PERMITIDO' }, 405);
  const authorization = req.headers.get('Authorization') ?? '';
  const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData } = await auth.auth.getUser();
  const user = userData.user;
  if (!user) return respostaJson({ codigo: 'NAO_AUTENTICADO' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let runId: string | null = null;

  async function encerrarComErro(tipoErro: TipoErroImportacao, mensagem: string, processados = 0) {
    if (!runId) return;
    await admin.from('marketing_instagram_import_run').update({
      status: 'ERRO', tipo_erro: tipoErro, mensagem: mensagem.slice(0, 2000),
      quantidade_processada: processados, finalizado_em: new Date().toISOString(),
    }).eq('id', runId);
  }

  try {
    const { workspace_id: workspaceId } = await req.json() as { workspace_id?: string };
    if (!workspaceId) return respostaJson({ codigo: 'PEDIDO_INVALIDO' }, 400);
    const { data: connection, error: connectionError } = await auth
      .from('marketing_instagram_connection')
      .select('id,ig_account_id,username').eq('workspace_id', workspaceId).maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return respostaJson({ codigo: 'CONTA_NAO_VINCULADA' }, 422);
    const { data: account, error: accountError } = await auth
      .from('ig_account').select('id,ig_user_id').eq('id', connection.ig_account_id).maybeSingle();
    if (accountError) throw accountError;
    if (!account) return respostaJson({ codigo: 'CONTA_NAO_DISPONIVEL' }, 403);

    const { data: run, error: runError } = await admin
      .from('marketing_instagram_import_run')
      .insert({ workspace_id: workspaceId, connection_id: connection.id, tipo: 'COMENTARIOS' })
      .select('id').single();
    if (runError) throw runError;
    runId = run.id;

    const { data: token, error: tokenError } = await admin.rpc('ler_token_instagram', { p_account_id: account.id });
    if (tokenError || !token) {
      await encerrarComErro('TOKEN_EXPIRADO', 'Token ausente ou expirado.');
      return respostaJson({ codigo: 'TOKEN_EXPIRADO' }, 401);
    }

    const { data: midias, error: midiasError } = await admin
      .from('marketing_instagram_metric_snapshot')
      .select('ig_media_id')
      .eq('workspace_id', workspaceId)
      .order('coletado_em', { ascending: false })
      .limit(200);
    if (midiasError) throw midiasError;
    const idsUnicos = [...new Set((midias ?? []).map((m) => m.ig_media_id as string))].slice(0, MAX_MEDIA_POR_INVOCACAO);

    let importados = 0;
    const coletadoEm = new Date().toISOString(); // fixo para todo o run

    for (const igMediaId of idsUnicos) {
      let url: string | null =
        `${GRAPH}/${igMediaId}/comments?fields=id,text,timestamp,from{username}&limit=${LIMITE_PAGINA}&access_token=${encodeURIComponent(token)}`;
      let paginas = 0;
      while (url && paginas < MAX_PAGINAS_POR_MEDIA) {
        const response = await fetch(url);
        const body = await response.json();
        if (!response.ok) {
          const tipoErro = mapearTipoErro(body?.error);
          await encerrarComErro(tipoErro, body?.error?.message ?? 'Erro desconhecido da Graph API.', importados);
          return respostaJson({ codigo: tipoErro, detalhe: body?.error?.message }, 502);
        }

        const linhas = ((body?.data ?? []) as ComentarioApi[]).map((c) => ({
          workspace_id: workspaceId, connection_id: connection.id, ig_media_id: igMediaId,
          ig_comment_id: c.id, autor_username: c.from?.username ?? null,
          texto: c.text ?? '', publicado_em: c.timestamp, coletado_em: coletadoEm,
        }));
        if (linhas.length) {
          // upsert sem ignoreDuplicates: texto/publicado_em atualizam se o comentário foi editado (E-09),
          // mas categoria/classificado_em/modelo_ia não entram no payload e ficam intactos.
          const { error: upsertError } = await admin
            .from('marketing_instagram_comment_snapshot')
            .upsert(linhas, { onConflict: 'workspace_id,ig_comment_id' });
          if (upsertError) throw upsertError;
          importados += linhas.length;
        }

        url = body.paging?.next ?? null;
        paginas++;
      }
    }

    await admin.from('marketing_instagram_import_run').update({
      status: 'SUCESSO', tipo_erro: importados === 0 ? 'SEM_DADOS' : null,
      quantidade_processada: importados, finalizado_em: new Date().toISOString(),
    }).eq('id', runId);

    return respostaJson({ importados, publicacoes: idsUnicos.length, conta: connection.username });
  } catch (error) {
    console.error('marketing-importar-comentarios-instagram:', error instanceof Error ? error.message : 'erro');
    await encerrarComErro('ERRO_DESCONHECIDO', error instanceof Error ? error.message : 'Erro desconhecido.');
    return respostaJson({ codigo: 'IMPORTACAO_INDISPONIVEL' }, 502);
  }
});
