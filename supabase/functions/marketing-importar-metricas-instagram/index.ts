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

// Matriz de métricas de insight por media_type (Onda 2, corrigida em produção 2026-09-16).
// A tentativa original chaveava por media_product_type (FEED/REELS/STORY), mas esse campo
// só existe para "Instagram API com Login do Facebook" — confirmado ao vivo em
// developers.facebook.com/documentation/instagram-platform/reference/instagram-media
// ("media_product_type... Disponível apenas para a API do Instagram com o Login do
// Facebook."), que não é o tipo de login deste projeto (graph.instagram.com). Na prática,
// o campo nunca vinha preenchido e a busca de insight nunca era sequer tentada, para
// nenhum post — bug real encontrado em produção, não falta de dado da conta. media_type
// (IMAGE/VIDEO/CAROUSEL_ALBUM) não tem essa restrição e é o que este arquivo já usa em
// outro lugar (ex. capa do post), por isso vira o discriminador correto aqui também.
// De fora de propósito: total_likes/total_comments/total_views (só Login do Facebook) e
// impressions (obsoleta para mídia criada após 02/07/2024 — todo conteúdo novo daqui em
// diante). STORY não entra: GET /{ig-user-id}/stories, a única forma documentada de listar
// stories, exige Login do Facebook nesta mesma documentação — sem forma confirmada de
// descobrir stories via Login do Instagram (investigação fechada, ver spec-kit).
const METRICAS_POR_TIPO_MEDIA: Record<string, string[]> = {
  IMAGE: ['likes', 'comments', 'reach', 'saved', 'shares', 'total_interactions', 'views'],
  CAROUSEL_ALBUM: ['likes', 'comments', 'reach', 'saved', 'shares', 'total_interactions', 'views'],
  VIDEO: ['likes', 'comments', 'reach', 'saved', 'shares', 'total_interactions', 'views', 'ig_reels_avg_watch_time'],
};

// Métricas de conta confirmadas para os dois tipos de login em developers.facebook.com/
// documentation/instagram-platform/api-reference/instagram-user/insights (atualizada 16/06/2026).
const METRICAS_CONTA = [
  'reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions',
  'accounts_engaged', 'profile_links_taps', 'follows_and_unfollows',
];

interface ItemInsight { name?: string; values?: Array<{ value?: number }>; total_value?: { value?: number } }

function extrairValor(item: ItemInsight): number | undefined {
  const valor = item.total_value?.value ?? item.values?.[0]?.value;
  return typeof valor === 'number' ? valor : undefined;
}

/**
 * Busca insights de uma mídia; nunca lança. Uma métrica ausente na resposta (mídia sem
 * dado suficiente, métrica não aplicável etc.) simplesmente não entra no objeto — nunca
 * vira zero — e uma falha na chamada não derruba a importação dos campos básicos do post.
 */
async function buscarInsightsMedia(mediaId: string, mediaType: string | null, token: string): Promise<Record<string, number>> {
  const metricas = mediaType ? METRICAS_POR_TIPO_MEDIA[mediaType] : undefined;
  if (!metricas || metricas.length === 0) return {};
  try {
    const resposta = await fetch(`${GRAPH}/${mediaId}/insights?metric=${metricas.join(',')}&access_token=${encodeURIComponent(token)}`);
    const corpo = await resposta.json();
    if (!resposta.ok) return {};
    const valores: Record<string, number> = {};
    for (const item of (corpo?.data ?? []) as ItemInsight[]) {
      const valor = extrairValor(item);
      if (typeof item.name === 'string' && valor !== undefined) valores[item.name] = valor;
    }
    return valores;
  } catch {
    return {};
  }
}

/** Insights diários de conta + contagem de seguidores; nunca lança — falha aqui não deve derrubar a importação de posts. */
async function buscarInsightsConta(igUserId: string, token: string): Promise<{ metricas: Record<string, number>; seguidores: number | null }> {
  const metricas: Record<string, number> = {};
  try {
    const resposta = await fetch(
      `${GRAPH}/${igUserId}/insights?metric=${METRICAS_CONTA.join(',')}&period=day&metric_type=total_value&access_token=${encodeURIComponent(token)}`,
    );
    const corpo = await resposta.json();
    if (resposta.ok) {
      for (const item of (corpo?.data ?? []) as ItemInsight[]) {
        const valor = extrairValor(item);
        if (typeof item.name === 'string' && valor !== undefined) metricas[item.name] = valor;
      }
    }
  } catch { /* segue sem métricas de conta */ }

  let seguidores: number | null = null;
  try {
    const resposta = await fetch(`${GRAPH}/${igUserId}?fields=followers_count&access_token=${encodeURIComponent(token)}`);
    const corpo = await resposta.json();
    if (resposta.ok && typeof corpo?.followers_count === 'number') seguidores = corpo.followers_count;
  } catch { /* segue sem contagem de seguidores */ }

  return { metricas, seguidores };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();
  if (req.method !== 'POST') return respostaJson({ codigo: 'METODO_NAO_PERMITIDO' }, 405);

  // Duas origens de chamada: o clique humano em "Importar métricas agora" (sessão de
  // usuário, verificada por auth.getUser()) e o cron diário (sem sessão nenhuma — só o
  // segredo dedicado, mesmo padrão de lgpd-expurgo-marketing). O cron nunca informa um
  // workspace_id arbitrário: quem escolhe os workspaces é marketing_cron_importar_
  // metricas_instagram() no banco, lendo direto de marketing_instagram_connection.
  const cronSecret = Deno.env.get('CRON_SECRET');
  const ehChamadaCron = Boolean(cronSecret) && req.headers.get('x-cron-secret') === cronSecret;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const leitor = ehChamadaCron
    ? admin
    : createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      });

  if (!ehChamadaCron) {
    const { data: userData } = await leitor.auth.getUser();
    if (!userData.user) return respostaJson({ codigo: 'NAO_AUTENTICADO' }, 401);
  }

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
    const { data: connection, error: connectionError } = await leitor
      .from('marketing_instagram_connection')
      .select('id,ig_account_id,username').eq('workspace_id', workspaceId).maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return respostaJson({ codigo: 'CONTA_NAO_VINCULADA' }, 422);
    const { data: account, error: accountError } = await leitor
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

      const itens = (body?.data ?? []) as Record<string, unknown>[];

      const midias = itens.map((media) => ({
        workspace_id: workspaceId, connection_id: connection.id, ig_media_id: String(media.id),
        media_type: typeof media.media_type === 'string' ? media.media_type : null,
        permalink: typeof media.permalink === 'string' ? media.permalink : null,
        publicado_em: typeof media.timestamp === 'string' ? media.timestamp : null,
      }));

      // Um insight por mídia (custo aceitável no volume desta conta); mídia sem
      // media_type reconhecido ou sem insight disponível não falha o lote.
      const insightsPorMidia = await Promise.all(itens.map((media) =>
        buscarInsightsMedia(
          String(media.id),
          typeof media.media_type === 'string' ? media.media_type : null,
          token,
        ),
      ));

      const linhas = itens.map((media, indice) => ({
        workspace_id: workspaceId, connection_id: connection.id, ig_media_id: String(media.id),
        permalink: typeof media.permalink === 'string' ? media.permalink : null,
        media_type: typeof media.media_type === 'string' ? media.media_type : null,
        publicado_em: typeof media.timestamp === 'string' ? media.timestamp : null,
        metricas: {
          likes: Number(media.like_count ?? 0), comentarios: Number(media.comments_count ?? 0),
          media_url: typeof media.media_url === 'string' ? media.media_url : null,
          thumbnail_url: typeof media.thumbnail_url === 'string' ? media.thumbnail_url : null,
          children: media.children ?? null,
          ...insightsPorMidia[indice],
        },
        coletado_em: coletadoEm,
      }));

      // A dimensão precisa existir antes do fato: marketing_instagram_metric_snapshot
      // tem FK para marketing_instagram_media desde a correção de dupla contagem (0030).
      if (midias.length) {
        const { error: mediaError } = await admin
          .from('marketing_instagram_media')
          .upsert(midias, { onConflict: 'workspace_id,ig_media_id' });
        if (mediaError) throw mediaError;
      }

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

    // Série diária de conta — upsert por dia (nunca acumula várias linhas por dia, ao
    // contrário do fato de mídia); falha aqui não derruba a importação de posts já feita.
    const hoje = new Date().toISOString().slice(0, 10);
    const { metricas: metricasConta, seguidores } = await buscarInsightsConta(account.ig_user_id, token);
    const { error: contaError } = await admin.from('marketing_instagram_account_metric_daily').upsert({
      workspace_id: workspaceId, connection_id: connection.id, data: hoje,
      seguidores, metricas: metricasConta, coletado_em: new Date().toISOString(),
    }, { onConflict: 'workspace_id,data' });
    if (contaError) console.error('marketing-importar-metricas-instagram (conta):', contaError.message);

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
