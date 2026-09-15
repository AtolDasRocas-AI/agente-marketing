// Gera estratégia e textos somente no servidor. A chave do provedor nunca chega ao navegador.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { respostaCors, respostaJson } from '../_shared/ig.ts';

const OPERACOES = new Set(['ESTRATEGIA', 'ANGULO', 'LEGENDA', 'CTA', 'PROMPT_IMAGEM']);

interface Pedido {
  content_item_id?: string;
  operacao?: string;
  idempotency_key?: string;
}

function codigoSeguro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'code' in erro && typeof erro.code === 'string') {
    return erro.code.slice(0, 120);
  }
  return 'FALHA_PROVEDOR';
}

function numeroAmbiente(nome: string): number | null {
  const valor = Number(Deno.env.get(nome));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

function promptPara(item: Record<string, unknown>, operacao: string): string {
  return [
    'Você é o assistente editorial da ATOL. Responda exclusivamente JSON válido, sem markdown.',
    'Não invente métricas, pesquisas ou promessas. Preserve linguagem clara em português do Brasil.',
    'Operação pedida: ' + operacao + '.',
    'Estruture sempre as chaves: estrategia, angulo, legenda, cta, hashtags, alt_text.',
    'briefing:',
    JSON.stringify({
      titulo: item.titulo,
      objetivo: item.objetivo,
      publico: item.publico,
      pilar: item.pilar,
      formato: item.formato,
      data_planejada: item.data_planejada,
      hipotese: item.hipotese,
    }),
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();
  if (req.method !== 'POST') return respostaJson({ codigo: 'METODO_NAO_PERMITIDO' }, 405);

  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
  const modelo = Deno.env.get('MARKETING_AI_TEXT_MODEL');
  const custoEstimado = numeroAmbiente('MARKETING_AI_ESTIMATED_COST_USD');
  if (!openRouterKey || !modelo || !custoEstimado) {
    return respostaJson({
      codigo: 'CONFIGURACAO_IA_AUSENTE',
      mensagem: 'A IA ainda não está configurada no servidor. Nenhuma chamada foi feita.',
    }, 503);
  }

  let aiRunId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;
  try {
    const pedido = await req.json() as Pedido;
    if (
      !pedido.content_item_id
      || !pedido.idempotency_key
      || !pedido.operacao
      || !OPERACOES.has(pedido.operacao)
    ) {
      return respostaJson({ codigo: 'PEDIDO_INVALIDO' }, 400);
    }

    const auth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: usuarioData } = await auth.auth.getUser();
    const usuario = usuarioData.user;
    if (!usuario) return respostaJson({ codigo: 'NAO_AUTENTICADO' }, 401);

    const { data: item, error: itemErro } = await auth
      .from('marketing_content_item')
      .select('id,workspace_id,titulo,objetivo,publico,pilar,formato,data_planejada,hipotese,status')
      .eq('id', pedido.content_item_id)
      .maybeSingle();
    if (itemErro) throw itemErro;
    if (!item) return respostaJson({ codigo: 'BRIEFING_NAO_ENCONTRADO' }, 404);
    if (!['PRONTO_PARA_ESTRATEGIA', 'EM_ESTRATEGIA', 'EM_REVISAO'].includes(item.status)) {
      return respostaJson({
        codigo: 'BRIEFING_INCOMPLETO',
        mensagem: 'Complete o briefing antes de pedir conteúdo à IA.',
      }, 422);
    }

    admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: execucao, error: inicioErro } = await admin.rpc('marketing_iniciar_execucao_ia', {
      p_workspace_id: item.workspace_id,
      p_content_item_id: item.id,
      p_solicitado_por: usuario.id,
      p_operacao: pedido.operacao,
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
        mensagem: 'A geração foi bloqueada pelo orçamento do workspace.',
        ai_run_id: execucao.id,
      }, 429);
    }
    if (execucao.status === 'CONCLUIDO') {
      return respostaJson({ ai_run_id: execucao.id, status: 'CONCLUIDO_REUTILIZADO' });
    }
    if (execucao.status !== 'EXECUTANDO') {
      return respostaJson({ codigo: 'EXECUCAO_NAO_DISPONIVEL', ai_run_id: execucao.id }, 409);
    }

    const resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + openRouterKey,
        'Content-Type': 'application/json',
        'X-OpenRouter-Metadata': 'enabled',
        'X-OpenRouter-Title': 'ATOL Studio Marketing',
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: 'Você produz conteúdo editorial estruturado para revisão humana.' },
          { role: 'user', content: promptPara(item, pedido.operacao) },
        ],
        max_tokens: 1200,
        temperature: 0.5,
        response_format: { type: 'json_object' },
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
    const conteudo = JSON.parse(texto);
    if (!conteudo || Array.isArray(conteudo) || typeof conteudo !== 'object') {
      const erro = new Error('RESPOSTA_IA_NAO_E_OBJETO') as Error & { code?: string };
      erro.code = 'RESPOSTA_IA_NAO_E_OBJETO';
      throw erro;
    }

    const { data: versao, error: fimErro } = await admin.rpc('marketing_finalizar_execucao_ia', {
      p_ai_run_id: aiRunId,
      p_resposta: conteudo,
      p_tokens_entrada: Math.max(0, Number(corpo?.usage?.prompt_tokens ?? 0)),
      p_tokens_saida: Math.max(0, Number(corpo?.usage?.completion_tokens ?? 0)),
      p_custo_real: Math.max(0, Number(corpo?.usage?.cost ?? custoEstimado)),
    });
    if (fimErro) throw fimErro;

    return respostaJson({
      ai_run_id: aiRunId,
      versao_id: versao.id,
      conteudo: versao.conteudo,
      custo_real: corpo?.usage?.cost ?? custoEstimado,
    });
  } catch (erro) {
    if (aiRunId && admin) {
      await admin.rpc('marketing_falhar_execucao_ia', {
        p_ai_run_id: aiRunId,
        p_erro_codigo: codigoSeguro(erro),
      });
    }
    console.error('marketing-gerar-conteudo:', codigoSeguro(erro));
    return respostaJson({
      codigo: 'GERACAO_INDISPONIVEL',
      mensagem: 'Não foi possível gerar o conteúdo agora. O briefing foi preservado.',
    }, 502);
  }
});
