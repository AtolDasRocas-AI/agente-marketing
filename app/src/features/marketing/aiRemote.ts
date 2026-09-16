import { exigirSupabase } from '../../lib/supabase';
import { mensagemDeErroFuncao } from '../../lib/erro';

export const OPERACOES_IA = ['ESTRATEGIA', 'ANGULO', 'LEGENDA', 'CTA', 'PROMPT_IMAGEM'] as const;
export type OperacaoIa = (typeof OPERACOES_IA)[number];

export interface OrcamentoIa {
  workspace_id: string;
  limite_mensal_usd: number;
  limite_por_execucao_usd: number;
  atualizado_em: string;
}

export interface VersaoConteudoIa {
  id: string;
  content_item_id: string;
  numero: number;
  operacao: OperacaoIa;
  origem: 'IA' | 'HUMANO';
  conteudo: Record<string, unknown>;
  criado_em: string;
}

export interface AprovacaoConteudo {
  id: string;
  content_version_id: string;
  decisao: 'PENDENTE' | 'APROVADO' | 'REPROVADO';
  observacao: string;
  criado_em: string;
}

export type PapelMarketing = 'ADMINISTRADOR' | 'REVISOR';

export class ErroAssistenteConteudo extends Error {
  readonly codigo: string;

  constructor(message: string, codigo: string) {
    super(message);
    this.name = 'ErroAssistenteConteudo';
    this.codigo = codigo;
  }
}

function erroRemoto(erro: { message?: string; code?: string } | null, alternativa: string): ErroAssistenteConteudo {
  return new ErroAssistenteConteudo(
    erro?.message ?? alternativa,
    erro?.code ?? 'INDISPONIVEL',
  );
}

export async function carregarOrcamentoIa(workspaceId: string): Promise<OrcamentoIa | null> {
  const { data, error } = await exigirSupabase()
    .from('marketing_ai_budget')
    .select('workspace_id,limite_mensal_usd,limite_por_execucao_usd,atualizado_em')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw erroRemoto(error, 'Não foi possível carregar o orçamento de IA.');
  return data
    ? {
        ...data,
        limite_mensal_usd: Number(data.limite_mensal_usd),
        limite_por_execucao_usd: Number(data.limite_por_execucao_usd),
      } as OrcamentoIa
    : null;
}

export async function configurarOrcamentoIa(
  workspaceId: string,
  mensal: number,
  porExecucao: number,
): Promise<OrcamentoIa> {
  if (!Number.isFinite(mensal) || !Number.isFinite(porExecucao) || mensal < 0 || porExecucao < 0) {
    throw new ErroAssistenteConteudo('Informe limites de custo válidos.', 'ORCAMENTO_INVALIDO');
  }
  const { data, error } = await exigirSupabase().rpc('marketing_configurar_orcamento_ia', {
    p_workspace_id: workspaceId,
    p_limite_mensal_usd: mensal,
    p_limite_por_execucao_usd: porExecucao,
  });
  if (error) throw erroRemoto(error, 'Não foi possível salvar o orçamento de IA.');
  return {
    ...data,
    limite_mensal_usd: Number(data.limite_mensal_usd),
    limite_por_execucao_usd: Number(data.limite_por_execucao_usd),
  } as OrcamentoIa;
}

export async function listarVersoesIa(contentItemId: string): Promise<VersaoConteudoIa[]> {
  const { data, error } = await exigirSupabase()
    .from('marketing_content_version')
    .select('id,content_item_id,numero,operacao,origem,conteudo,criado_em')
    .eq('content_item_id', contentItemId)
    .order('criado_em', { ascending: false });
  if (error) throw erroRemoto(error, 'Não foi possível carregar as versões de conteúdo.');
  return (data ?? []) as VersaoConteudoIa[];
}

export async function listarAprovacoesConteudo(contentItemId: string): Promise<AprovacaoConteudo[]> {
  const { data, error } = await exigirSupabase()
    .from('marketing_content_approval')
    .select('id,content_version_id,decisao,observacao,criado_em')
    .eq('content_item_id', contentItemId)
    .order('criado_em', { ascending: false });
  if (error) throw erroRemoto(error, 'Não foi possível carregar as aprovações.');
  return (data ?? []) as AprovacaoConteudo[];
}

export async function obterPapelMarketing(workspaceId: string): Promise<PapelMarketing | null> {
  const { data, error } = await exigirSupabase()
    .from('marketing_member')
    .select('papel')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw erroRemoto(error, 'Não foi possível carregar sua permissão no workspace.');
  return data?.papel === 'ADMINISTRADOR' || data?.papel === 'REVISOR' ? data.papel : null;
}

export async function solicitarAprovacaoConteudo(
  workspaceId: string, contentItemId: string, contentVersionId: string,
): Promise<void> {
  const { error } = await exigirSupabase().rpc('marketing_solicitar_aprovacao_conteudo', {
    p_workspace_id: workspaceId,
    p_content_item_id: contentItemId,
    p_content_version_id: contentVersionId,
    p_observacao: '',
  });
  if (error) throw erroRemoto(error, 'Não foi possível enviar a versão para aprovação.');
}

export async function decidirAprovacaoConteudo(
  workspaceId: string, approvalId: string, aprovar: boolean,
): Promise<void> {
  const { error } = await exigirSupabase().rpc('marketing_decidir_aprovacao_conteudo', {
    p_workspace_id: workspaceId,
    p_approval_id: approvalId,
    p_aprovar: aprovar,
    p_observacao: '',
  });
  if (error) throw erroRemoto(error, 'Não foi possível registrar a decisão.');
}

export async function gerarConteudoIa(
  contentItemId: string,
  operacao: OperacaoIa,
  comTextoSobreposto = false,
): Promise<void> {
  const { data, error } = await exigirSupabase().functions.invoke('marketing-gerar-conteudo', {
    body: {
      content_item_id: contentItemId,
      operacao,
      idempotency_key: crypto.randomUUID(),
      com_texto_sobreposto: comTextoSobreposto || undefined,
    },
  });
  if (error) throw new ErroAssistenteConteudo(await mensagemDeErroFuncao(error), 'INDISPONIVEL');
  if (data?.codigo) {
    throw new ErroAssistenteConteudo(
      data.mensagem ?? 'A geração de conteúdo foi bloqueada.',
      data.codigo,
    );
  }
}

export interface TextoOverlay {
  titulo?: string;
  itens: string[];
}

export interface ImagemGerada {
  id: string;
  content_version_id: string;
  storage_path: string;
  modelo_ia: string;
  custo_usd: number | null;
  gerado_em: string;
  origem_imagem_id: string | null;
  texto_overlay: TextoOverlay | null;
}

export async function listarImagensGeradas(contentItemId: string): Promise<ImagemGerada[]> {
  const { data, error } = await exigirSupabase()
    .from('marketing_image_asset')
    .select('id,content_version_id,storage_path,modelo_ia,custo_usd,gerado_em,origem_imagem_id,texto_overlay')
    .eq('content_item_id', contentItemId)
    .order('gerado_em', { ascending: false });
  if (error) throw erroRemoto(error, 'Não foi possível carregar as imagens geradas.');
  return (data ?? []) as ImagemGerada[];
}

// Proporções reais do Instagram (2026): feed padrão é retrato 4:5, stories/reels 9:16.
export const FORMATOS_IMAGEM = {
  FEED: { rotulo: 'Feed (4:5)', largura: 1080, altura: 1350 },
  STORY: { rotulo: 'Stories/Reels (9:16)', largura: 1080, altura: 1920 },
} as const;

export type FormatoImagem = keyof typeof FORMATOS_IMAGEM;

// Mesmas chaves de TELAS_DO_APP em supabase/functions/_shared/identidadeVisual.ts.
export const TELAS_DO_APP: Record<string, string> = {
  DASHBOARD: 'Dashboard',
  PARAMETROS: 'Parâmetros da água',
  ALERTAS: 'Alertas',
  ASSISTENTE_IA: 'Assistente de IA',
  HABITANTES: 'Habitantes',
  DIARIO: 'Diário',
  REEF_VIRTUAL: 'Reef Virtual',
  CRIAR_CONTEUDO: 'Criar conteúdo',
  ILUMINACAO: 'Iluminação',
  PROTOCOLOS: 'Protocolos',
  CONFIGURACOES: 'Configurações',
};

export interface AjusteImagem {
  textoAjuste?: string;
  imagemReferenciaBase64?: string;
}

export async function gerarImagemIa(
  contentVersionId: string,
  ajuste?: AjusteImagem,
  formato: FormatoImagem = 'FEED',
  telasDoApp: string[] = [],
): Promise<void> {
  const { data, error } = await exigirSupabase().functions.invoke('marketing-gerar-imagem', {
    body: {
      content_version_id: contentVersionId,
      idempotency_key: crypto.randomUUID(),
      texto_ajuste: ajuste?.textoAjuste || undefined,
      imagem_referencia_base64: ajuste?.imagemReferenciaBase64 || undefined,
      formato,
      telas_do_app: telasDoApp.length > 0 ? telasDoApp : undefined,
    },
  });
  if (error) throw new ErroAssistenteConteudo(await mensagemDeErroFuncao(error), 'INDISPONIVEL');
  if (data?.codigo) {
    throw new ErroAssistenteConteudo(
      data.mensagem ?? 'A geração de imagem foi bloqueada.',
      data.codigo,
    );
  }
}

export async function melhorarTextoImagem(
  contentVersionId: string,
  textoOverlay: TextoOverlay,
  instrucao?: string,
): Promise<TextoOverlay> {
  const { data, error } = await exigirSupabase().functions.invoke('marketing-melhorar-texto-imagem', {
    body: {
      content_version_id: contentVersionId,
      texto_overlay: textoOverlay,
      instrucao: instrucao?.trim() || undefined,
      idempotency_key: crypto.randomUUID(),
    },
  });
  if (error) throw new ErroAssistenteConteudo(await mensagemDeErroFuncao(error), 'INDISPONIVEL');
  if (data?.codigo) {
    throw new ErroAssistenteConteudo(data.mensagem ?? 'Não foi possível melhorar o texto.', data.codigo);
  }
  return data.texto_overlay as TextoOverlay;
}

export async function comporImagemComTexto(
  imagemBaseId: string,
  imagemCompostaBase64: string,
  textoOverlay: TextoOverlay,
): Promise<void> {
  const { data, error } = await exigirSupabase().functions.invoke('marketing-compor-imagem-texto', {
    body: {
      imagem_base_id: imagemBaseId,
      imagem_composta_base64: imagemCompostaBase64,
      texto_overlay: textoOverlay,
    },
  });
  if (error) throw new ErroAssistenteConteudo(await mensagemDeErroFuncao(error), 'INDISPONIVEL');
  if (data?.codigo) {
    throw new ErroAssistenteConteudo(data.mensagem ?? 'Não foi possível salvar a composição.', data.codigo);
  }
}

export function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem de referência.'));
    leitor.readAsDataURL(arquivo);
  });
}

export async function urlAssinadaImagem(storagePath: string): Promise<string | null> {
  const { data, error } = await exigirSupabase().storage.from('marketing-imagens').createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

export function formatarUsd(valor: number | null | undefined): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(valor ?? 0);
}
