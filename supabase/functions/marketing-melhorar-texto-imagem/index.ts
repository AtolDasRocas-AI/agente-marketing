// Agente que reescreve o texto sobreposto de um post informativo (título + itens), usando
// o briefing e o conteúdo editorial já aprovado como contexto. Devolve a sugestão para
// revisão humana na tela — não grava nada nem cria versão de conteúdo; quem decide se o
// texto novo entra é sempre a pessoa que revisa.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extrairJson, respostaCors, respostaJson } from '../_shared/ig.ts';

interface TextoOverlay {
  titulo?: string;
  itens: string[];
}

interface Pedido {
  content_version_id?: string;
  texto_overlay?: TextoOverlay;
  instrucao?: string;
  idempotency_key?: string;
}

const MAXIMO_ITENS = 5;
const TAMANHO_MAXIMO_ITEM = 200;
const TAMANHO_MAXIMO_TITULO = 120;
const TAMANHO_MAXIMO_INSTRUCAO = 500;

function codigoSeguro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'code' in erro && typeof erro.code === 'string') return erro.code.slice(0, 120);
  return 'FALHA_PROVEDOR';
}

function numeroAmbiente(nome: string): number | null {
  const valor = Number(Deno.env.get(nome));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

function textoOverlayValido(valor: unknown): valor is TextoOverlay {
  if (!valor || typeof valor !== 'object') return false;
  const objeto = valor as Record<string, unknown>;
  if (
    objeto.titulo !== undefined
    && (typeof objeto.titulo !== 'string' || objeto.titulo.length > TAMANHO_MAXIMO_TITULO)
  ) {
    return false;
  }
  if (!Array.isArray(objeto.itens) || objeto.itens.length < 1 || objeto.itens.length > MAXIMO_ITENS) return false;
  return objeto.itens.every(
    (item) => typeof item === 'string' && item.trim().length > 0 && item.length <= TAMANHO_MAXIMO_ITEM,
  );
}

// Normaliza o que o modelo devolveu: corta excesso de itens e campos fora do formato, em
// vez de falhar — o texto vai para revisão humana de qualquer forma.
function normalizarResposta(conteudo: Record<string, unknown>): TextoOverlay | null {
  const itens = Array.isArray(conteudo.itens)
    ? conteudo.itens
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().slice(0, TAMANHO_MAXIMO_ITEM))
      .slice(0, MAXIMO_ITENS)
    : [];
  if (itens.length === 0) return null;
  const titulo = typeof conteudo.titulo === 'string' && conteudo.titulo.trim()
    ? conteudo.titulo.trim().slice(0, TAMANHO_MAXIMO_TITULO)
    : undefined;
  return { titulo, itens };
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
      mensagem: 'A IA ainda não está configurada no servidor.',
    }, 503);
  }

  let aiRunId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;
  try {
    const pedido = await req.json() as Pedido;
    if (!pedido.content_version_id || !pedido.idempotency_key) return respostaJson({ codigo: 'PEDIDO_INVALIDO' }, 400);
    if (!textoOverlayValido(pedido.texto_overlay)) return respostaJson({ codigo: 'TEXTO_OVERLAY_INVALIDO' }, 400);
    if (pedido.instrucao !== undefined && pedido.instrucao.length > TAMANHO_MAXIMO_INSTRUCAO) {
      return respostaJson({ codigo: 'INSTRUCAO_MUITO_LONGA' }, 400);
    }

    const auth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: usuarioData } = await auth.auth.getUser();
    const usuario = usuarioData.user;
    if (!usuario) return respostaJson({ codigo: 'NAO_AUTENTICADO' }, 401);

    // RLS decide: só devolve a versão se o usuário for membro do workspace dono dela.
    const { data: versao, error: versaoErro } = await auth
      .from('marketing_content_version')
      .select('id,workspace_id,content_item_id')
      .eq('id', pedido.content_version_id)
      .maybeSingle();
    if (versaoErro) throw versaoErro;
    if (!versao) return respostaJson({ codigo: 'VERSAO_NAO_ENCONTRADA' }, 404);

    const { data: item, error: itemErro } = await auth
      .from('marketing_content_item')
      .select('titulo,objetivo,publico,pilar,hipotese')
      .eq('id', versao.content_item_id)
      .maybeSingle();
    if (itemErro) throw itemErro;

    admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: execucao, error: inicioErro } = await admin.rpc('marketing_iniciar_execucao_ia_livre', {
      p_workspace_id: versao.workspace_id,
      p_solicitado_por: usuario.id,
      p_operacao: 'MELHORAR_TEXTO_IMAGEM',
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
        mensagem: 'A melhoria de texto foi bloqueada pelo orçamento do workspace.',
      }, 429);
    }
    if (execucao.status !== 'EXECUTANDO') {
      return respostaJson({ codigo: 'EXECUCAO_NAO_DISPONIVEL' }, 409);
    }

    const prompt = [
      'Você é o editor de texto da ATOL, especialista em peças informativas para Instagram.',
      'Responda exclusivamente JSON válido, sem markdown, com as chaves: titulo (string curta) e itens (array de 3 a 5 strings).',
      'Todo o texto deve estar em português do Brasil. Não invente métricas, pesquisas, preços nem promessas.',
      'Este texto será desenhado SOBRE uma imagem, então cada item precisa ser curto e legível no feed: '
      + 'no máximo cerca de 60 caracteres, uma ideia por item, sem ponto final, sem emoji e sem hashtag. '
      + 'O título deve ter no máximo cerca de 40 caracteres.',
      'Melhore a clareza, a força e a especificidade do texto abaixo, mantendo o mesmo significado e a mesma '
      + 'promessa — nunca troque o assunto do post nem adicione informação que não esteja no briefing.',
      ...(pedido.instrucao?.trim() ? ['Ajuste pedido pelo revisor humano: ' + pedido.instrucao.trim()] : []),
      'briefing:',
      JSON.stringify(item ?? {}),
      'texto atual:',
      JSON.stringify(pedido.texto_overlay),
    ].join('\n');

    const resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + openRouterKey,
        'Content-Type': 'application/json',
        'X-OpenRouter-Title': 'ATOL Studio Marketing - Texto da imagem',
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: 'Você reescreve textos curtos de peças gráficas para revisão humana.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.5,
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
    const sugestao = normalizarResposta(extrairJson(texto));
    if (!sugestao) {
      const erro = new Error('RESPOSTA_IA_INVALIDA') as Error & { code?: string };
      erro.code = 'RESPOSTA_IA_INVALIDA';
      throw erro;
    }

    const { error: fimErro } = await admin.rpc('marketing_finalizar_execucao_ia_livre', {
      p_ai_run_id: aiRunId,
      p_resposta: sugestao,
      p_tokens_entrada: Math.max(0, Number(corpo?.usage?.prompt_tokens ?? 0)),
      p_tokens_saida: Math.max(0, Number(corpo?.usage?.completion_tokens ?? 0)),
      p_custo_real: Math.max(0, Number(corpo?.usage?.cost ?? custoEstimado)),
    });
    if (fimErro) throw fimErro;

    return respostaJson({ texto_overlay: sugestao });
  } catch (erro) {
    if (aiRunId && admin) {
      await admin.rpc('marketing_falhar_execucao_ia', { p_ai_run_id: aiRunId, p_erro_codigo: codigoSeguro(erro) });
    }
    console.error('marketing-melhorar-texto-imagem:', codigoSeguro(erro));
    return respostaJson({
      codigo: 'MELHORIA_INDISPONIVEL',
      mensagem: 'Não foi possível melhorar o texto agora.',
    }, 502);
  }
});
