// Persiste a composição determinística de texto sobre uma imagem já gerada (posts
// "informativos" — checklist/dica/estatística). O texto exato do briefing é desenhado no
// navegador, com a tipografia e as cores reais da marca (ver EstrategiaConteudo.tsx); esta
// function só recebe o PNG final já pronto e grava. Nunca é uma chamada de IA — por isso
// não passa pelos RPCs de orçamento (marketing_iniciar_execucao_ia_livre), e o custo é 0.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { respostaCors, respostaJson } from '../_shared/ig.ts';

interface TextoOverlay {
  titulo?: string;
  itens: string[];
}

interface Pedido {
  imagem_base_id?: string;
  imagem_composta_base64?: string;
  texto_overlay?: TextoOverlay;
}

const REGEX_DATA_URI_IMAGEM = /^data:image\/(png|jpeg|jpg|webp);base64,/;
const TAMANHO_MAXIMO_IMAGEM = 8_000_000;
const MAXIMO_ITENS = 5;
const TAMANHO_MAXIMO_ITEM = 200;
const TAMANHO_MAXIMO_TITULO = 120;

function textoOverlayValido(valor: unknown): valor is TextoOverlay {
  if (!valor || typeof valor !== 'object') return false;
  const objeto = valor as Record<string, unknown>;
  if (
    objeto.titulo !== undefined
    && (typeof objeto.titulo !== 'string' || objeto.titulo.length > TAMANHO_MAXIMO_TITULO)
  ) {
    return false;
  }
  if (!Array.isArray(objeto.itens) || objeto.itens.length < 1 || objeto.itens.length > MAXIMO_ITENS) {
    return false;
  }
  return objeto.itens.every(
    (item) => typeof item === 'string' && item.trim().length > 0 && item.length <= TAMANHO_MAXIMO_ITEM,
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();
  if (req.method !== 'POST') return respostaJson({ codigo: 'METODO_NAO_PERMITIDO' }, 405);

  try {
    const pedido = await req.json() as Pedido;
    if (!pedido.imagem_base_id) return respostaJson({ codigo: 'PEDIDO_INVALIDO' }, 400);
    if (
      !pedido.imagem_composta_base64
      || pedido.imagem_composta_base64.length > TAMANHO_MAXIMO_IMAGEM
      || !REGEX_DATA_URI_IMAGEM.test(pedido.imagem_composta_base64)
    ) {
      return respostaJson({ codigo: 'IMAGEM_COMPOSTA_INVALIDA' }, 400);
    }
    if (!textoOverlayValido(pedido.texto_overlay)) {
      return respostaJson({ codigo: 'TEXTO_OVERLAY_INVALIDO' }, 400);
    }

    const auth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: usuarioData } = await auth.auth.getUser();
    const usuario = usuarioData.user;
    if (!usuario) return respostaJson({ codigo: 'NAO_AUTENTICADO' }, 401);

    // RLS do client "auth" (não admin) só devolve a linha se o usuário for membro do
    // workspace dono desta imagem — é essa checagem que autoriza a composição.
    const { data: imagemBase, error: imagemBaseErro } = await auth
      .from('marketing_image_asset')
      .select('id,workspace_id,content_item_id,content_version_id,prompt_aprovado')
      .eq('id', pedido.imagem_base_id)
      .maybeSingle();
    if (imagemBaseErro) throw imagemBaseErro;
    if (!imagemBase) return respostaJson({ codigo: 'IMAGEM_BASE_NAO_ENCONTRADA' }, 404);

    const match = pedido.imagem_composta_base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return respostaJson({ codigo: 'IMAGEM_COMPOSTA_INVALIDA' }, 400);
    const [, mimeType, base64Dados] = match;
    const bytes = Uint8Array.from(atob(base64Dados), (c) => c.charCodeAt(0));
    const extensao = mimeType.split('/')[1] ?? 'png';
    const caminho = `${imagemBase.workspace_id}/${imagemBase.id}-composta-${Date.now()}.${extensao}`;

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error: uploadErro } = await admin.storage
      .from('marketing-imagens')
      .upload(caminho, bytes, { contentType: mimeType });
    if (uploadErro) throw uploadErro;

    const { data: asset, error: assetErro } = await admin.from('marketing_image_asset').insert({
      workspace_id: imagemBase.workspace_id,
      content_item_id: imagemBase.content_item_id,
      content_version_id: imagemBase.content_version_id,
      prompt_aprovado: imagemBase.prompt_aprovado,
      modelo_ia: 'composicao-manual',
      custo_usd: 0,
      storage_path: caminho,
      gerado_por: usuario.id,
      origem_imagem_id: imagemBase.id,
      texto_overlay: pedido.texto_overlay,
    }).select().single();
    if (assetErro) throw assetErro;

    return respostaJson({ asset });
  } catch (erro) {
    console.error('marketing-compor-imagem-texto:', erro);
    return respostaJson({
      codigo: 'COMPOSICAO_INDISPONIVEL',
      mensagem: 'Não foi possível salvar a composição agora.',
    }, 502);
  }
});
