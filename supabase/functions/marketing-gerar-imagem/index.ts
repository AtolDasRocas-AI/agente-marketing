// Gera imagem a partir de um PROMPT_IMAGEM já aprovado por humano (Sprint F).
// Nunca gera sem aprovação; nunca publica automaticamente; grava em bucket privado.
//
// ATENÇÃO: o formato exato da resposta de imagem do OpenRouter (campo `images` na mensagem,
// como data URI) segue a convenção documentada para modelos multimodais no momento em que
// este código foi escrito. Revalidar contra a documentação viva do OpenRouter e testar com
// o modelo real (ver docs/estudo-llms-agentes-atol.md) antes de liberar em produção — isto,
// diferente do gateway de texto de marketing-gerar-conteudo, nunca foi exercitado de verdade.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { respostaCors, respostaJson } from '../_shared/ig.ts';

function numeroAmbiente(nome: string): number | null {
  const valor = Number(Deno.env.get(nome));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}
function codigoSeguro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'code' in erro && typeof erro.code === 'string') return erro.code.slice(0, 120);
  return 'FALHA_PROVEDOR';
}

interface Pedido { content_version_id?: string; idempotency_key?: string }

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

    const resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + openRouterKey,
        'Content-Type': 'application/json',
        'X-OpenRouter-Title': 'ATOL Studio Marketing - Imagem',
      },
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: 'user', content: promptAprovado }],
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
