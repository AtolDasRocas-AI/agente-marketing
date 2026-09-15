// Importação somente-leitura, paginada e com log de execução (Sprint B).
// Não chama endpoints de publicação do Instagram.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GRAPH, respostaCors, respostaJson } from '../_shared/ig.ts';

const MAX_PAGINAS_POR_INVOCACAO = 10; // ~500 publicações por chamada
const LIMITE_PAGINA = 50;

interface ErroGraphApi { message?: string; code?: number; error_subcode?: number }
type TipoErroImportacao = 'TOKEN_EXPIRADO' | 'PERMISSAO_AUSENTE' | 'LIMITE_META' | 'ERRO_DESCONHECIDO';

/** Mapeia códigos conhecidos da Graph API (achados reais deste projeto: 190 = token, 200 = permissão) */
function mapearTipoErro(erro: ErroGraphApi | undefined): TipoErroImportacao {
  const codigo = erro?.code;
  if (codigo === 190) return 'TOKEN_EXPIRADO';
  if (codigo === 200 || codigo === 10) return 'PERMISSAO_AUSENTE';
  if (codigo === 4 || codigo === 17 || codigo === 32) return 'LIMITE_META';
  return 'ERRO_DESCONHECIDO';
}

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

  async function encerrarComErro(tipoErro: TipoErroImportacao, mensagem: string, processados = 0, cursor: string | null = null) {
    if (!runId) return;
    await admin.from('marketing_instagram_import_run').update({
      status: 'ERRO', tipo_erro: tipoErro, mensagem: mensagem.slice(0, 2000),
      quantidade_processada: processados, cursor_pagina: cursor, finalizado_em: new Date().toISOString(),
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
      .insert({ workspace_id: workspaceId, connection_id: connection.id })
      .select('id').single();
    if (runError) throw runError;
    runId = run.id;

    const { data: token, error: tokenError } = await admin.rpc('ler_token_instagram', { p_account_id: account.id });
    if (tokenError || !token) {
      await encerrarComErro('TOKEN_EXPIRADO', 'Token ausente ou expirado.');
      return respostaJson({ codigo: 'TOKEN_EXPIRADO' }, 401);
    }

    // media_url/thumbnail_url servem de capa na tela; expiram como qualquer URL da CDN do
    // Instagram, por isso o frontend (CapaPost) sempre tem fallback para ícone + rótulo.
    const campos =
      'id,permalink,media_type,timestamp,like_count,comments_count,media_url,thumbnail_url,' +
      'children{media_url,thumbnail_url,media_type}';
    let url: string | null =
      `${GRAPH}/${account.ig_user_id}/media?fields=${campos}&limit=${LIMITE_PAGINA}&access_token=${encodeURIComponent(token)}`;

    const coletadoEm = new Date().toISOString(); // fixo para todo o run: evita duplicar snapshot se uma página repetir
    let importados = 0;
    let paginas = 0;
    let cursor: string | null = null;

    while (url && paginas < MAX_PAGINAS_POR_INVOCACAO) {
      const response = await fetch(url);
      const body = await response.json();
      if (!response.ok) {
        const tipoErro = mapearTipoErro(body?.error);
        await encerrarComErro(tipoErro, body?.error?.message ?? 'Erro desconhecido da Graph API.', importados, cursor);
        return respostaJson({ codigo: tipoErro, detalhe: body?.error?.message }, 502);
      }

      const linhas = (body?.data ?? []).map((media: Record<string, unknown>) => ({
        workspace_id: workspaceId, connection_id: connection.id, ig_media_id: String(media.id),
        permalink: typeof media.permalink === 'string' ? media.permalink : null,
        media_type: typeof media.media_type === 'string' ? media.media_type : null,
        publicado_em: typeof media.timestamp === 'string' ? media.timestamp : null,
        metricas: {
          likes: Number(media.like_count ?? 0), comentarios: Number(media.comments_count ?? 0),
          media_url: typeof media.media_url === 'string' ? media.media_url : null,
          thumbnail_url: typeof media.thumbnail_url === 'string' ? media.thumbnail_url : null,
          children: media.children ?? null,
        },
        coletado_em: coletadoEm,
      }));

      if (linhas.length) {
        const { error: upsertError } = await admin
          .from('marketing_instagram_metric_snapshot')
          .upsert(linhas, { onConflict: 'workspace_id,ig_media_id,coletado_em', ignoreDuplicates: true });
        if (upsertError) throw upsertError;
        importados += linhas.length;
      }

      cursor = body.paging?.cursors?.after ?? cursor;
      url = body.paging?.next ?? null;
      paginas++;
    }

    const concluido = !url;
    await admin.from('marketing_instagram_import_run').update({
      status: 'SUCESSO', tipo_erro: importados === 0 ? 'SEM_DADOS' : null,
      quantidade_processada: importados, cursor_pagina: concluido ? null : cursor,
      finalizado_em: new Date().toISOString(),
    }).eq('id', runId);

    return respostaJson({ importados, conta: connection.username, concluido });
  } catch (error) {
    console.error('marketing-importar-metricas-instagram:', error instanceof Error ? error.message : 'erro');
    await encerrarComErro('ERRO_DESCONHECIDO', error instanceof Error ? error.message : 'Erro desconhecido.');
    return respostaJson({ codigo: 'IMPORTACAO_INDISPONIVEL' }, 502);
  }
});
