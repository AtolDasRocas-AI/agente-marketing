// Classifica comentários pendentes em 7 categorias fixas via IA (Sprint C).
// Nunca gera resposta para publicar; só rotula para leitura interna da equipe.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extrairJson, respostaCors, respostaJson } from '../_shared/ig.ts';

const CATEGORIAS = ['DUVIDA', 'ELOGIO', 'RECLAMACAO', 'INTENCAO_COMPRA', 'PEDIDO_SUPORTE', 'SPAM', 'NAO_CLASSIFICADO'] as const;
type Categoria = (typeof CATEGORIAS)[number];
const LOTE = 20;

function numeroAmbiente(nome: string): number | null {
  const valor = Number(Deno.env.get(nome));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

function codigoSeguro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'code' in erro && typeof erro.code === 'string') return erro.code.slice(0, 120);
  return 'FALHA_PROVEDOR';
}

interface Pedido { workspace_id?: string; idempotency_key?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();
  if (req.method !== 'POST') return respostaJson({ codigo: 'METODO_NAO_PERMITIDO' }, 405);

  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
  const modelo = Deno.env.get('MARKETING_AI_COMMENT_MODEL');
  const custoEstimado = numeroAmbiente('MARKETING_AI_COMMENT_ESTIMATED_COST_USD');
  if (!openRouterKey || !modelo || !custoEstimado) {
    return respostaJson({
      codigo: 'CONFIGURACAO_IA_AUSENTE',
      mensagem: 'A IA de classificação de comentários ainda não está configurada no servidor.',
    }, 503);
  }

  let aiRunId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;
  try {
    const pedido = await req.json() as Pedido;
    if (!pedido.workspace_id || !pedido.idempotency_key) return respostaJson({ codigo: 'PEDIDO_INVALIDO' }, 400);

    const auth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: usuarioData } = await auth.auth.getUser();
    const usuario = usuarioData.user;
    if (!usuario) return respostaJson({ codigo: 'NAO_AUTENTICADO' }, 401);

    admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: pendentes, error: pendentesErro } = await admin
      .from('marketing_instagram_comment_snapshot')
      .select('id,texto')
      .eq('workspace_id', pedido.workspace_id)
      .is('categoria', null)
      .limit(LOTE);
    if (pendentesErro) throw pendentesErro;
    if (!pendentes || pendentes.length === 0) {
      return respostaJson({ classificados: 0, mensagem: 'Nenhum comentário pendente de classificação.' });
    }

    const { data: execucao, error: inicioErro } = await admin.rpc('marketing_iniciar_execucao_ia_livre', {
      p_workspace_id: pedido.workspace_id,
      p_solicitado_por: usuario.id,
      p_operacao: 'CLASSIFICAR_COMENTARIO',
      p_provedor: 'openrouter',
      p_modelo: modelo,
      p_limite_tokens: 800,
      p_idempotency_key: pedido.idempotency_key,
      p_custo_estimado: custoEstimado,
    });
    if (inicioErro) throw inicioErro;
    aiRunId = execucao.id;
    if (execucao.status === 'BLOQUEADO') {
      return respostaJson({
        codigo: execucao.erro_codigo,
        mensagem: 'A classificação foi bloqueada pelo orçamento do workspace.',
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
      'Você classifica comentários do Instagram da ATOL em exatamente uma categoria cada.',
      'Categorias válidas: ' + CATEGORIAS.join(', ') + '.',
      'DUVIDA = pergunta sobre produto/serviço. ELOGIO = feedback positivo. RECLAMACAO = insatisfação.',
      'INTENCAO_COMPRA = interesse em comprar/contratar. PEDIDO_SUPORTE = problema técnico ou de atendimento.',
      'SPAM = irrelevante, propaganda de terceiros ou bot. NAO_CLASSIFICADO = não se encaixa claramente em nenhuma anterior.',
      'Nunca redija uma resposta ao comentário — apenas classifique.',
      'Responda só JSON: {"classificacoes":[{"id":"...","categoria":"..."}]}.',
      'Comentários:',
      JSON.stringify(pendentes.map((c) => ({ id: c.id, texto: c.texto }))),
    ].join('\n');

    const resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + openRouterKey,
        'Content-Type': 'application/json',
        'X-OpenRouter-Title': 'ATOL Studio Marketing - Comentarios',
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: 'Você classifica textos curtos em categorias fixas, sem gerar conteúdo novo.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0,
        // sem response_format: suporte varia por modelo/provedor no OpenRouter;
        // a instrucao no prompt pedindo JSON puro já é suficiente.
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
    let conteudo: { classificacoes?: Array<{ id?: string; categoria?: string }> };
    try {
      conteudo = extrairJson(texto);
    } catch {
      const erro = new Error('RESPOSTA_IA_INVALIDA') as Error & { code?: string };
      erro.code = 'RESPOSTA_IA_INVALIDA';
      throw erro;
    }
    const classificacoes = Array.isArray(conteudo?.classificacoes) ? conteudo.classificacoes : [];

    const idsValidos = new Set(pendentes.map((c) => c.id as string));
    let classificados = 0;
    for (const item of classificacoes) {
      if (!item.id || !idsValidos.has(item.id)) continue;
      const categoria: Categoria = (CATEGORIAS as readonly string[]).includes(item.categoria ?? '')
        ? (item.categoria as Categoria)
        : 'NAO_CLASSIFICADO';
      const { error: updateErro } = await admin
        .from('marketing_instagram_comment_snapshot')
        .update({ categoria, classificado_em: new Date().toISOString(), modelo_ia: modelo })
        .eq('id', item.id);
      if (updateErro) throw updateErro;
      classificados++;
    }
    // comentários que o modelo não retornou ficam pendentes para a próxima chamada, nunca forçados a uma categoria.

    const { error: fimErro } = await admin.rpc('marketing_finalizar_execucao_ia_livre', {
      p_ai_run_id: aiRunId,
      p_resposta: { classificados, total_pendentes_no_lote: pendentes.length },
      p_tokens_entrada: Math.max(0, Number(corpo?.usage?.prompt_tokens ?? 0)),
      p_tokens_saida: Math.max(0, Number(corpo?.usage?.completion_tokens ?? 0)),
      p_custo_real: Math.max(0, Number(corpo?.usage?.cost ?? custoEstimado)),
    });
    if (fimErro) throw fimErro;

    return respostaJson({ ai_run_id: aiRunId, classificados, total_pendentes_no_lote: pendentes.length });
  } catch (erro) {
    if (aiRunId && admin) {
      await admin.rpc('marketing_falhar_execucao_ia', { p_ai_run_id: aiRunId, p_erro_codigo: codigoSeguro(erro) });
    }
    console.error('marketing-classificar-comentarios:', codigoSeguro(erro));
    return respostaJson({
      codigo: 'CLASSIFICACAO_INDISPONIVEL',
      mensagem: 'Não foi possível classificar agora. Os comentários seguem pendentes.',
    }, 502);
  }
});
