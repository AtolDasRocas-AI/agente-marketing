// Importação somente-leitura. Não chama endpoints de publicação do Instagram.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GRAPH, respostaCors, respostaJson } from '../_shared/ig.ts';

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
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: token, error: tokenError } = await admin.rpc('ler_token_instagram', { p_account_id: account.id });
    if (tokenError || !token) throw tokenError ?? new Error('TOKEN_AUSENTE');
    const response = await fetch(`${GRAPH}/${account.ig_user_id}/media?fields=id,permalink,media_type,timestamp,like_count,comments_count&limit=50&access_token=${encodeURIComponent(token)}`);
    const body = await response.json();
    if (!response.ok) return respostaJson({ codigo: 'INSTAGRAM_LEITURA_INDISPONIVEL', detalhe: body?.error?.message }, 502);
    const rows = (body?.data ?? []).map((media: Record<string, unknown>) => ({
      workspace_id: workspaceId, connection_id: connection.id, ig_media_id: String(media.id),
      permalink: typeof media.permalink === 'string' ? media.permalink : null,
      media_type: typeof media.media_type === 'string' ? media.media_type : null,
      publicado_em: typeof media.timestamp === 'string' ? media.timestamp : null,
      metricas: { likes: Number(media.like_count ?? 0), comentarios: Number(media.comments_count ?? 0) },
    }));
    if (rows.length) {
      const { error: insertError } = await admin.from('marketing_instagram_metric_snapshot').insert(rows);
      if (insertError) throw insertError;
    }
    return respostaJson({ importados: rows.length, conta: connection.username });
  } catch (error) {
    console.error('marketing-importar-metricas-instagram:', error instanceof Error ? error.message : 'erro');
    return respostaJson({ codigo: 'IMPORTACAO_INDISPONIVEL' }, 502);
  }
});
