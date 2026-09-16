// Gera imagem a partir de um PROMPT_IMAGEM já aprovado por humano (Sprint F).
// Nunca gera sem aprovação; nunca publica automaticamente; grava em bucket privado.
//
// Modelo confirmado no catálogo real do OpenRouter em 2026-09-15: google/gemini-3.1-flash-lite-image
// ("Nano Banana 2 Lite"), $0,25/$30 por 1M tokens, exemplo real no playground custou $0,0336/imagem.
// Formato de resposta confirmado ao vivo em 2026-09-15 (campo `images`/data URI na mensagem).
// ATENÇÃO NOVA: `texto_ajuste`/`imagem_referencia_base64` (regeneração com ajuste humano) usam
// o mesmo endpoint com uma imagem de entrada (`image_url` no conteúdo da mensagem) — isso ainda
// NÃO foi testado contra a API real (só o caminho sem imagem de referência foi). Se o modelo
// ignorar a imagem de referência ou devolver erro, é o parsing/formato de entrada que precisa
// de ajuste, não a lógica de aprovação/orçamento em volta.
// ATENÇÃO NOVA 2: toda geração agora também anexa até 4 referências REAIS da marca (logo,
// clima visual, telas do app — ver _shared/identidadeVisual.ts). O comportamento do modelo
// com MÚLTIPLAS imagens de referência simultâneas nunca foi testado contra a API real (só 0
// ou 1 imagem foi exercitado até hoje) — se o resultado sair ruim/confuso, desligar via
// MARKETING_AI_IMAGE_BRAND_REFS_ENABLED=false antes de investigar mais a fundo.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { respostaCors, respostaJson } from '../_shared/ig.ts';
import { carregarReferenciasDeMarca, referenciasDeMarcaHabilitadas } from '../_shared/identidadeVisual.ts';

function numeroAmbiente(nome: string): number | null {
  const valor = Number(Deno.env.get(nome));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}
function codigoSeguro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'code' in erro && typeof erro.code === 'string') return erro.code.slice(0, 120);
  return 'FALHA_PROVEDOR';
}

interface Pedido {
  content_version_id?: string;
  idempotency_key?: string;
  texto_ajuste?: string;
  imagem_referencia_base64?: string;
}

const REGEX_DATA_URI_IMAGEM = /^data:image\/(png|jpeg|jpg|webp);base64,/;
const TAMANHO_MAXIMO_REFERENCIA = 6_000_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();
  if (req.method !== 'POST') return respostaJson({ codigo: 'METODO_NAO_PERMITIDO' }, 405);

  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
  const modelo = Deno.env.get('MARKETING_AI_IMAGE_MODEL');
  const custoEstimado = numeroAmbiente('MARKETING_AI_IMAGE_ESTIMATED_COST_USD');
  if (!openRouterKey || !modelo || !custoEstimado) {
    return respostaJson({
      codigo: 'CONFIGURACAO_IA_AUSENTE',
      mensagem: 'A IA de geração de imagem ainda não está configurada no servidor.',
    }, 503);
  }

  let aiRunId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;
  try {
    const pedido = await req.json() as Pedido;
    if (!pedido.content_version_id || !pedido.idempotency_key) return respostaJson({ codigo: 'PEDIDO_INVALIDO' }, 400);
    if (pedido.texto_ajuste !== undefined && pedido.texto_ajuste.length > 2000) {
      return respostaJson({ codigo: 'AJUSTE_MUITO_LONGO' }, 400);
    }
    if (pedido.imagem_referencia_base64 !== undefined) {
      if (pedido.imagem_referencia_base64.length > TAMANHO_MAXIMO_REFERENCIA) {
        return respostaJson({ codigo: 'IMAGEM_REFERENCIA_MUITO_GRANDE' }, 400);
      }
      if (!REGEX_DATA_URI_IMAGEM.test(pedido.imagem_referencia_base64)) {
        return respostaJson({ codigo: 'IMAGEM_REFERENCIA_INVALIDA' }, 400);
      }
    }

    const auth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: usuarioData } = await auth.auth.getUser();
    const usuario = usuarioData.user;
    if (!usuario) return respostaJson({ codigo: 'NAO_AUTENTICADO' }, 401);

    admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: versao, error: versaoErro } = await admin
      .from('marketing_content_version')
      .select('id,workspace_id,content_item_id,operacao,conteudo')
      .eq('id', pedido.content_version_id).maybeSingle();
    if (versaoErro) throw versaoErro;
    if (!versao || versao.operacao !== 'PROMPT_IMAGEM') {
      return respostaJson({ codigo: 'VERSAO_NAO_E_PROMPT_IMAGEM' }, 422);
    }
    const promptAprovado = (versao.conteudo as Record<string, unknown> | null)?.prompt_imagem;
    if (typeof promptAprovado !== 'string' || !promptAprovado.trim()) {
      return respostaJson({ codigo: 'PROMPT_VAZIO' }, 422);
    }

    const { data: aprovacao, error: aprovacaoErro } = await admin
      .from('marketing_content_approval')
      .select('decisao').eq('content_version_id', versao.id).maybeSingle();
    if (aprovacaoErro) throw aprovacaoErro;
    if (!aprovacao || aprovacao.decisao !== 'APROVADO') {
      return respostaJson({
        codigo: 'PROMPT_NAO_APROVADO',
        mensagem: 'Só é possível gerar imagem a partir de um prompt aprovado por um administrador.',
      }, 422);
    }

    const { data: execucao, error: inicioErro } = await admin.rpc('marketing_iniciar_execucao_ia_livre', {
      p_workspace_id: versao.workspace_id,
      p_solicitado_por: usuario.id,
      p_operacao: 'GERAR_IMAGEM',
      p_provedor: 'openrouter',
      p_modelo: modelo,
      p_limite_tokens: 1,
      p_idempotency_key: pedido.idempotency_key,
      p_custo_estimado: custoEstimado,
    });
    if (inicioErro) throw inicioErro;
    aiRunId = execucao.id;
    if (execucao.status === 'BLOQUEADO') {
      return respostaJson({
        codigo: execucao.erro_codigo,
        mensagem: 'A geração de imagem foi bloqueada pelo orçamento do workspace.',
        ai_run_id: execucao.id,
      }, 429);
    }
    if (execucao.status === 'CONCLUIDO') {
      return respostaJson({ ai_run_id: execucao.id, status: 'CONCLUIDO_REUTILIZADO' });
    }
    if (execucao.status !== 'EXECUTANDO') {
      return respostaJson({ codigo: 'EXECUCAO_NAO_DISPONIVEL', ai_run_id: execucao.id }, 409);
    }

    const referenciasMarca = referenciasDeMarcaHabilitadas()
      ? await carregarReferenciasDeMarca(admin).catch((erro) => {
          console.error('marketing-gerar-imagem: referencias de marca indisponiveis, seguindo sem elas:', erro);
          return [];
        })
      : [];
    const preambuloReferencias = referenciasMarca.length > 0
      ? `As primeiras ${referenciasMarca.length} imagens anexadas nesta mensagem são referências REAIS e fixas ` +
        'da identidade visual da marca ATOL (nesta ordem: logotipo oficial, foto que ilustra o clima visual do ' +
        'produto real, e telas reais do aplicativo ATOL IA). Use-as só como âncora de estilo, paleta de cores, ' +
        'iluminação e "clima" — nunca copie a cena, a composição ou qualquer texto de interface delas ' +
        'literalmente.\n\n'
      : '';

    const temReferencia = Boolean(pedido.imagem_referencia_base64);
    const promptFinal = preambuloReferencias + (pedido.texto_ajuste?.trim()
      ? temReferencia
        // Com imagem de referência, a instrução é de EDIÇÃO — reenviar a descrição
        // original da cena (às vezes em outro idioma/intenção) confundia o modelo
        // entre "recriar do zero" e "editar a imagem anexada". "Última" desambigua
        // qual imagem é a de ajuste quando referências de marca também são anexadas.
        ? `Use a última imagem anexada como base exata. Aplique apenas este ajuste, preservando o restante (composição, pessoas, cores, layout) o mais fielmente possível: ${pedido.texto_ajuste.trim()}`
        : `${promptAprovado}\n\nAjuste pedido pelo revisor humano em relação à tentativa anterior: ${pedido.texto_ajuste.trim()}`
      : promptAprovado);
    // Ordem importa: referências de marca primeiro (âncora geral de estilo), imagem de
    // ajuste do usuário sempre por último (âncora mais específica — "edite exatamente isto").
    const conteudoMensagem: Array<Record<string, unknown>> = [
      { type: 'text', text: promptFinal },
      ...referenciasMarca,
    ];
    if (pedido.imagem_referencia_base64) {
      conteudoMensagem.push({ type: 'image_url', image_url: { url: pedido.imagem_referencia_base64 } });
    }

    const resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + openRouterKey,
        'Content-Type': 'application/json',
        'X-OpenRouter-Title': 'ATOL Studio Marketing - Imagem',
      },
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: 'user', content: conteudoMensagem }],
        modalities: ['image', 'text'],
      }),
    });
    const corpo = await resposta.json();
    if (!resposta.ok) {
      const erro = new Error('OPENROUTER_HTTP_' + resposta.status) as Error & { code?: string };
      erro.code = 'OPENROUTER_HTTP_' + resposta.status;
      throw erro;
    }
    const imagemDataUri = corpo?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
    const match = imagemDataUri?.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      const erro = new Error('RESPOSTA_IMAGEM_INVALIDA') as Error & { code?: string };
      erro.code = 'RESPOSTA_IMAGEM_INVALIDA';
      throw erro;
    }
    const [, mimeType, base64Dados] = match;
    const bytes = Uint8Array.from(atob(base64Dados), (c) => c.charCodeAt(0));
    const extensao = mimeType.split('/')[1] ?? 'png';
    const caminho = `${versao.workspace_id}/${versao.id}-${Date.now()}.${extensao}`;

    const { error: uploadErro } = await admin.storage
      .from('marketing-imagens')
      .upload(caminho, bytes, { contentType: mimeType });
    if (uploadErro) throw uploadErro;

    const custoReal = Math.max(0, Number(corpo?.usage?.cost ?? custoEstimado));
    const { data: asset, error: assetErro } = await admin.from('marketing_image_asset').insert({
      workspace_id: versao.workspace_id,
      content_item_id: versao.content_item_id,
      content_version_id: versao.id,
      ai_run_id: aiRunId,
      prompt_aprovado: promptAprovado,
      modelo_ia: modelo,
      custo_usd: custoReal,
      storage_path: caminho,
      gerado_por: usuario.id,
    }).select().single();
    if (assetErro) throw assetErro;

    const { error: fimErro } = await admin.rpc('marketing_finalizar_execucao_ia_livre', {
      p_ai_run_id: aiRunId,
      p_resposta: { storage_path: caminho },
      p_tokens_entrada: 0,
      p_tokens_saida: 0,
      p_custo_real: custoReal,
    });
    if (fimErro) throw fimErro;

    return respostaJson({ ai_run_id: aiRunId, asset });
  } catch (erro) {
    if (aiRunId && admin) {
      await admin.rpc('marketing_falhar_execucao_ia', { p_ai_run_id: aiRunId, p_erro_codigo: codigoSeguro(erro) });
    }
    console.error('marketing-gerar-imagem:', codigoSeguro(erro));
    return respostaJson({
      codigo: 'IMAGEM_INDISPONIVEL',
      mensagem: 'Não foi possível gerar a imagem agora.',
    }, 502);
  }
});
