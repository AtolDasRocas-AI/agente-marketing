// Gera hipótese de inteligência de produto a partir de métricas, notas e comentários (Sprint E).
// Regra inegociável: nunca afirma causalidade. Toda hipótese fica PENDENTE até decisão humana.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extrairJson, respostaCors, respostaJson } from '../_shared/ig.ts';

const CONFIANCAS = ['BAIXA', 'MEDIA', 'ALTA'] as const;

function numeroAmbiente(nome: string): number | null {
  const valor = Number(Deno.env.get(nome));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}
function codigoSeguro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'code' in erro && typeof erro.code === 'string') return erro.code.slice(0, 120);
  return 'FALHA_PROVEDOR';
}

interface Pedido { workspace_id?: string; idempotency_key?: string; periodo_dias?: number }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();
  if (req.method !== 'POST') return respostaJson({ codigo: 'METODO_NAO_PERMITIDO' }, 405);

  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
  const modelo = Deno.env.get('MARKETING_AI_INSIGHT_MODEL');
  const custoEstimado = numeroAmbiente('MARKETING_AI_INSIGHT_ESTIMATED_COST_USD');
  if (!openRouterKey || !modelo || !custoEstimado) {
    return respostaJson({
      codigo: 'CONFIGURACAO_IA_AUSENTE',
      mensagem: 'A IA de inteligência de produto ainda não está configurada no servidor.',
    }, 503);
  }

  let aiRunId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;
  try {
    const pedido = await req.json() as Pedido;
    if (!pedido.workspace_id || !pedido.idempotency_key) return respostaJson({ codigo: 'PEDIDO_INVALIDO' }, 400);
    const periodoDias = pedido.periodo_dias && pedido.periodo_dias > 0 ? pedido.periodo_dias : 7;

    const auth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: usuarioData } = await auth.auth.getUser();
    const usuario = usuarioData.user;
    if (!usuario) return respostaJson({ codigo: 'NAO_AUTENTICADO' }, 401);

    admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const fimPeriodo = new Date();
    const inicioPeriodo = new Date(fimPeriodo.getTime() - periodoDias * 86_400_000);
    const inicioIso = inicioPeriodo.toISOString();

    const [{ data: metricas, error: metricasErro }, { data: notas, error: notasErro }, { data: comentarios, error: comentariosErro }] = await Promise.all([
      admin.from('marketing_instagram_metric_snapshot').select('ig_media_id,media_type,metricas,coletado_em')
        .eq('workspace_id', pedido.workspace_id).gte('coletado_em', inicioIso).order('coletado_em', { ascending: false }),
      admin.from('marketing_context_note').select('titulo,categoria,ocorrido_em,nota')
        .eq('workspace_id', pedido.workspace_id).is('arquivado_em', null)
        .gte('ocorrido_em', inicioPeriodo.toISOString().slice(0, 10)).order('ocorrido_em', { ascending: false }),
      admin.from('marketing_instagram_comment_snapshot').select('categoria')
        .eq('workspace_id', pedido.workspace_id).gte('coletado_em', inicioIso).not('categoria', 'is', null),
    ]);
    if (metricasErro) throw metricasErro;
    if (notasErro) throw notasErro;
    if (comentariosErro) throw comentariosErro;

    if (!metricas || metricas.length === 0) {
      return respostaJson({
        codigo: 'DADOS_INSUFICIENTES',
        mensagem: 'Sem métricas importadas no período para gerar uma hipótese.',
      }, 422);
    }

    const distribuicaoCategorias = (comentarios ?? []).reduce<Record<string, number>>((acc, c) => {
      const categoria = String(c.categoria);
      acc[categoria] = (acc[categoria] ?? 0) + 1;
      return acc;
    }, {});

    const entradaResumida = {
      periodo_inicio: inicioPeriodo.toISOString().slice(0, 10),
      periodo_fim: fimPeriodo.toISOString().slice(0, 10),
      publicacoes: metricas.length,
      metricas_agregadas: metricas.map((m) => ({ ig_media_id: m.ig_media_id, tipo: m.media_type, ...(m.metricas as Record<string, unknown>) })),
      notas_de_contexto: (notas ?? []).map((n) => ({ titulo: n.titulo, categoria: n.categoria, data: n.ocorrido_em })),
      distribuicao_categorias_comentarios: distribuicaoCategorias,
    };

    const { data: execucao, error: inicioErro } = await admin.rpc('marketing_iniciar_execucao_ia_livre', {
      p_workspace_id: pedido.workspace_id,
      p_solicitado_por: usuario.id,
      p_operacao: 'GERAR_INSIGHT',
      p_provedor: 'openrouter',
      p_modelo: modelo,
      p_limite_tokens: 1200,
      p_idempotency_key: pedido.idempotency_key,
      p_custo_estimado: custoEstimado,
    });
    if (inicioErro) throw inicioErro;
    aiRunId = execucao.id;
    if (execucao.status === 'BLOQUEADO') {
      return respostaJson({
        codigo: execucao.erro_codigo,
        mensagem: 'A geração de hipótese foi bloqueada pelo orçamento do workspace.',
        ai_run_id: execucao.id,
      }, 429);
    }
    if (execucao.status === 'CONCLUIDO') {
      return respostaJson({ ai_run_id: execucao.id, status: 'CONCLUIDO_REUTILIZADO' });
    }
    if (execucao.status !== 'EXECUTANDO') {
      return respostaJson({ codigo: 'EXECUCAO_NAO_DISPONIVEL', ai_run_id: execucao.id }, 409);
    }

    const prompt = [
      'Você é o agente de inteligência de produto da ATOL. Analise os dados e proponha UMA hipótese revisável.',
      'Regra inegociável: nunca afirme causalidade. Uma nota de contexto só pode "coincidir com o período", nunca "causar" um resultado.',
      'Se os dados forem insuficientes para uma hipótese razoável, prefira confianca "BAIXA" a inventar uma conclusão forte.',
      'Responda só JSON com as chaves: hipotese (string), evidencias (array de strings), limitacoes (string),',
      'confianca ("BAIXA"|"MEDIA"|"ALTA"), proxima_acao (string).',
      'Dados do período:',
      JSON.stringify(entradaResumida),
    ].join('\n');

    const resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + openRouterKey,
        'Content-Type': 'application/json',
        'X-OpenRouter-Title': 'ATOL Studio Marketing - Insight',
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: 'Você produz hipóteses cautelosas de inteligência de produto, nunca afirmações causais, para revisão humana.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1200,
        temperature: 0.3,
        // sem response_format: nao é suportado da mesma forma por todo modelo/provedor no
        // OpenRouter (json_object/json_schema variam por endpoint) — a instrucao no prompt
        // pedindo JSON puro já é suficiente e funciona com qualquer modelo.
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
    let conteudo: {
      hipotese?: string; evidencias?: string[]; limitacoes?: string; confianca?: string; proxima_acao?: string;
    };
    try {
      conteudo = extrairJson(texto);
    } catch {
      const erro = new Error('RESPOSTA_IA_INVALIDA') as Error & { code?: string };
      erro.code = 'RESPOSTA_IA_INVALIDA';
      throw erro;
    }
    if (!conteudo?.hipotese || !CONFIANCAS.includes((conteudo.confianca ?? '') as typeof CONFIANCAS[number])) {
      const erro = new Error('RESPOSTA_IA_INCOMPLETA') as Error & { code?: string };
      erro.code = 'RESPOSTA_IA_INCOMPLETA';
      throw erro;
    }

    const custoReal = Math.max(0, Number(corpo?.usage?.cost ?? custoEstimado));

    // Grava o insight antes de finalizar a execução: se algo falhar depois daqui, o pior caso é um
    // ai_run preso em EXECUTANDO (sem custo debitado), nunca um custo debitado sem hipótese visível.
    const { data: insight, error: insightErro } = await admin.from('marketing_insight').insert({
      workspace_id: pedido.workspace_id,
      ai_run_id: aiRunId,
      periodo_inicio: entradaResumida.periodo_inicio,
      periodo_fim: entradaResumida.periodo_fim,
      entrada_resumida: entradaResumida,
      hipotese: conteudo.hipotese,
      evidencias: conteudo.evidencias ?? [],
      limitacoes: conteudo.limitacoes ?? '',
      confianca: conteudo.confianca,
      proxima_acao: conteudo.proxima_acao ?? '',
      custo_usd: custoReal,
      modelo_ia: modelo,
    }).select().single();
    if (insightErro) throw insightErro;

    const { error: fimErro } = await admin.rpc('marketing_finalizar_execucao_ia_livre', {
      p_ai_run_id: aiRunId,
      p_resposta: conteudo,
      p_tokens_entrada: Math.max(0, Number(corpo?.usage?.prompt_tokens ?? 0)),
      p_tokens_saida: Math.max(0, Number(corpo?.usage?.completion_tokens ?? 0)),
      p_custo_real: custoReal,
    });
    if (fimErro) throw fimErro;

    return respostaJson({ ai_run_id: aiRunId, insight });
  } catch (erro) {
    if (aiRunId && admin) {
      await admin.rpc('marketing_falhar_execucao_ia', { p_ai_run_id: aiRunId, p_erro_codigo: codigoSeguro(erro) });
    }
    console.error('marketing-gerar-insight:', codigoSeguro(erro));
    return respostaJson({
      codigo: 'INSIGHT_INDISPONIVEL',
      mensagem: 'Não foi possível gerar a hipótese agora.',
    }, 502);
  }
});
