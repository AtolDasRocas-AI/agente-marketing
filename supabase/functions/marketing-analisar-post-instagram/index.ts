// Análise de IA por post individual (Onda 5): leitura + sugestão, versionada e
// append-only. Automática quando o post matura (7 dias) ou sob pedido manual de
// reanálise — nunca reprocessa sozinha depois da primeira vez. Reaproveita o mesmo
// gateway de orçamento/ledger já usado por marketing-gerar-insight.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extrairJson, respostaCors, respostaJson } from '../_shared/ig.ts';

const MATURIDADE_DIAS = 7;
const CAMPOS_METRICA_RELEVANTES = ['likes', 'comentarios', 'reach', 'views', 'saved', 'shares', 'total_interactions'] as const;

function numeroAmbiente(nome: string): number | null {
  const valor = Number(Deno.env.get(nome));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}
function codigoSeguro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'code' in erro && typeof erro.code === 'string') return erro.code.slice(0, 120);
  return 'FALHA_PROVEDOR';
}
function metricasRelevantes(m: Record<string, unknown>): Record<string, number> {
  const saida: Record<string, number> = {};
  for (const campo of CAMPOS_METRICA_RELEVANTES) {
    const valor = m[campo];
    if (typeof valor === 'number') saida[campo] = valor;
  }
  return saida;
}
function interacoesTotais(m: Record<string, unknown>): number {
  const relevantes = metricasRelevantes(m);
  return Number(relevantes.total_interactions ?? Number(relevantes.likes ?? 0) + Number(relevantes.comentarios ?? 0));
}

interface PostSnapshot { ig_media_id: string; media_type: string | null; permalink: string | null; publicado_em: string | null; metricas: Record<string, unknown> }
type ResultadoAnalise = { codigo: string; mensagem?: string } | { analise_id: string };

async function gerarAnalise(
  admin: ReturnType<typeof createClient>, openRouterKey: string, modelo: string, custoEstimado: number,
  workspaceId: string, solicitadoPor: string, post: PostSnapshot, origem: 'AUTOMATICA' | 'MANUAL',
): Promise<ResultadoAnalise> {
  const { data: outrosPosts, error: outrosErro } = await admin.rpc('marketing_instagram_ultimo_snapshot', { p_workspace_id: workspaceId });
  if (outrosErro) throw outrosErro;
  const mesmoFormato = ((outrosPosts ?? []) as PostSnapshot[]).filter((p) => p.ig_media_id !== post.ig_media_id && p.media_type === post.media_type);
  const mediaFormato = mesmoFormato.length
    ? mesmoFormato.reduce((soma, p) => soma + interacoesTotais(p.metricas), 0) / mesmoFormato.length
    : null;

  const { data: versaoRow } = await admin.from('marketing_instagram_post_analysis')
    .select('numero').eq('workspace_id', workspaceId).eq('ig_media_id', post.ig_media_id)
    .order('numero', { ascending: false }).limit(1).maybeSingle();
  const proximoNumero = (versaoRow?.numero ?? 0) + 1;

  const { data: execucao, error: inicioErro } = await admin.rpc('marketing_iniciar_execucao_ia_livre', {
    p_workspace_id: workspaceId, p_solicitado_por: solicitadoPor, p_operacao: 'ANALISAR_POST',
    p_provedor: 'openrouter', p_modelo: modelo, p_limite_tokens: 800,
    p_idempotency_key: crypto.randomUUID(), p_custo_estimado: custoEstimado,
  });
  if (inicioErro) throw inicioErro;
  const aiRunId = execucao.id;
  if (execucao.status === 'BLOQUEADO') return { codigo: execucao.erro_codigo, mensagem: 'A análise foi bloqueada pelo orçamento do workspace.' };
  if (execucao.status !== 'EXECUTANDO') return { codigo: 'EXECUCAO_NAO_DISPONIVEL' };

  try {
    const prompt = [
      'Você é o agente de análise de posts da ATOL. Leia o desempenho deste post e escreva uma leitura qualitativa',
      'curta (pontos fortes/fracos do que pode explicar o resultado) e uma sugestão prática para o próximo conteúdo parecido.',
      'Nunca afirme causalidade certa — é uma leitura para revisão humana, não uma conclusão definitiva.',
      'Responda só JSON com as chaves: analise (string, até 3 frases), sugestao (string, 1-2 frases).',
      'Dados do post:',
      JSON.stringify({
        data_publicacao: post.publicado_em ? String(post.publicado_em).slice(0, 10) : 'sem data',
        formato: post.media_type,
        link: post.permalink,
        metricas: metricasRelevantes(post.metricas),
        media_interacoes_mesmo_formato_outros_posts: mediaFormato !== null ? Math.round(mediaFormato) : 'sem comparação disponível',
      }),
    ].join('\n');

    const resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + openRouterKey, 'Content-Type': 'application/json',
        'X-OpenRouter-Title': 'ATOL Studio Marketing - Analise de Post',
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: 'Você produz leituras curtas e cautelosas de desempenho de posts, para revisão humana.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });
    const corpo = await resposta.json();
    if (!resposta.ok) {
      const erro = new Error('OPENROUTER_HTTP_' + resposta.status) as Error & { code?: string };
      erro.code = 'OPENROUTER_HTTP_' + resposta.status;
      throw erro;
    }
    const texto = corpo?.choices?.[0]?.message?.content;
    if (typeof texto !== 'string') {
      const erro = new Error('RESPOSTA_IA_INVALIDA') as Error & { code?: string };
      erro.code = 'RESPOSTA_IA_INVALIDA';
      throw erro;
    }
    let conteudo: { analise?: string; sugestao?: string };
    try {
      conteudo = extrairJson(texto);
    } catch {
      const erro = new Error('RESPOSTA_IA_INVALIDA') as Error & { code?: string };
      erro.code = 'RESPOSTA_IA_INVALIDA';
      throw erro;
    }
    if (!conteudo?.analise) {
      const erro = new Error('RESPOSTA_IA_INCOMPLETA') as Error & { code?: string };
      erro.code = 'RESPOSTA_IA_INCOMPLETA';
      throw erro;
    }

    const custoReal = Math.max(0, Number(corpo?.usage?.cost ?? custoEstimado));
    const { data: analise, error: analiseErro } = await admin.from('marketing_instagram_post_analysis').insert({
      workspace_id: workspaceId, ig_media_id: post.ig_media_id, numero: proximoNumero,
      analise: conteudo.analise, sugestao: conteudo.sugestao ?? '', modelo_ia: modelo,
      custo_usd: custoReal, ai_run_id: aiRunId, solicitado_por: solicitadoPor, origem,
    }).select('id').single();
    if (analiseErro) throw analiseErro;

    const { error: fimErro } = await admin.rpc('marketing_finalizar_execucao_ia_livre', {
      p_ai_run_id: aiRunId,
      p_resposta: conteudo,
      p_tokens_entrada: Math.max(0, Number(corpo?.usage?.prompt_tokens ?? 0)),
      p_tokens_saida: Math.max(0, Number(corpo?.usage?.completion_tokens ?? 0)),
      p_custo_real: custoReal,
    });
    if (fimErro) throw fimErro;

    return { analise_id: analise.id };
  } catch (erro) {
    await admin.rpc('marketing_falhar_execucao_ia', { p_ai_run_id: aiRunId, p_erro_codigo: codigoSeguro(erro) });
    throw erro;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();
  if (req.method !== 'POST') return respostaJson({ codigo: 'METODO_NAO_PERMITIDO' }, 405);

  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
  const modelo = Deno.env.get('MARKETING_AI_POST_ANALYSIS_MODEL');
  const custoEstimado = numeroAmbiente('MARKETING_AI_POST_ANALYSIS_ESTIMATED_COST_USD');
  if (!openRouterKey || !modelo || !custoEstimado) {
    return respostaJson({
      codigo: 'CONFIGURACAO_IA_AUSENTE',
      mensagem: 'A IA de análise de post ainda não está configurada no servidor.',
    }, 503);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const cronSecret = Deno.env.get('CRON_SECRET');
  const ehChamadaCron = Boolean(cronSecret) && req.headers.get('x-cron-secret') === cronSecret;

  try {
    if (ehChamadaCron) {
      // Modo lote: um post maduro (7+ dias) sem análise ainda vira uma análise nova, por
      // workspace conectado. Nunca reanalisa sozinho um post que já tem análise — isso é
      // sempre um pedido manual (mais abaixo). Uma falha num post não derruba os outros.
      const { data: conexoes, error: conexoesErro } = await admin.from('marketing_instagram_connection').select('workspace_id');
      if (conexoesErro) throw conexoesErro;

      let analisados = 0;
      for (const { workspace_id } of conexoes ?? []) {
        const { data: administrador } = await admin.from('marketing_member').select('user_id')
          .eq('workspace_id', workspace_id).eq('papel', 'ADMINISTRADOR').limit(1).maybeSingle();
        if (!administrador) continue;

        const corte = new Date(Date.now() - MATURIDADE_DIAS * 86_400_000).toISOString();
        const { data: posts, error: postsErro } = await admin.rpc('marketing_instagram_ultimo_snapshot', {
          p_workspace_id: workspace_id, p_publicado_ate: corte,
        });
        if (postsErro) { console.error('marketing-analisar-post-instagram (posts):', postsErro.message); continue; }

        const { data: existentes } = await admin.from('marketing_instagram_post_analysis')
          .select('ig_media_id').eq('workspace_id', workspace_id);
        const jaAnalisados = new Set((existentes ?? []).map((r) => r.ig_media_id));

        for (const post of (posts ?? []) as PostSnapshot[]) {
          if (jaAnalisados.has(post.ig_media_id)) continue;
          try {
            const resultado = await gerarAnalise(admin, openRouterKey, modelo, custoEstimado, workspace_id, administrador.user_id, post, 'AUTOMATICA');
            if ('analise_id' in resultado) analisados++;
          } catch (erro) {
            console.error('marketing-analisar-post-instagram (post):', post.ig_media_id, codigoSeguro(erro));
          }
        }
      }
      return respostaJson({ analisados });
    }

    // Modo manual: pedido explícito de um usuário autenticado, sempre cria uma versão
    // nova (primeira análise ou reanálise usam o mesmo caminho).
    const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: usuarioData } = await auth.auth.getUser();
    const usuario = usuarioData.user;
    if (!usuario) return respostaJson({ codigo: 'NAO_AUTENTICADO' }, 401);

    const { workspace_id: workspaceId, ig_media_id: igMediaId } = await req.json() as { workspace_id?: string; ig_media_id?: string };
    if (!workspaceId || !igMediaId) return respostaJson({ codigo: 'PEDIDO_INVALIDO' }, 400);

    const { data: posts, error: postsErro } = await admin.rpc('marketing_instagram_ultimo_snapshot', { p_workspace_id: workspaceId });
    if (postsErro) throw postsErro;
    const post = ((posts ?? []) as PostSnapshot[]).find((p) => p.ig_media_id === igMediaId);
    if (!post) return respostaJson({ codigo: 'POST_NAO_ENCONTRADO' }, 404);

    const resultado = await gerarAnalise(admin, openRouterKey, modelo, custoEstimado, workspaceId, usuario.id, post, 'MANUAL');
    if ('codigo' in resultado) return respostaJson(resultado, resultado.codigo === 'EXECUCAO_NAO_DISPONIVEL' ? 409 : 429);
    return respostaJson(resultado);
  } catch (erro) {
    console.error('marketing-analisar-post-instagram:', codigoSeguro(erro));
    return respostaJson({ codigo: 'ANALISE_INDISPONIVEL', mensagem: 'Não foi possível gerar a análise agora.' }, 502);
  }
});
