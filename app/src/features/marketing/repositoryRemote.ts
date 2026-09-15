import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirSupabase } from '../../lib/supabase';
import type { ConteudoMarketing, DadosBriefing } from './model';

const NOME_WORKSPACE_INICIAL = 'ATOL Marketing';
const CHAVE_WORKSPACE_INICIAL = 'a7101a6d-20ee-4ed6-8df6-21e12a2bfb0d';

export interface WorkspaceMarketing {
  id: string;
  nome: string;
  criado_em: string;
}

export interface ConteudoMarketingRemoto extends ConteudoMarketing {
  workspace_id: string;
  versao: number;
}

export interface LinhaConteudoMarketing {
  id: string;
  workspace_id: string;
  titulo: string;
  objetivo: string;
  publico: string;
  pilar: string;
  formato: 'FEED' | 'CARROSSEL';
  data_planejada: string | null;
  hipotese: string;
  status: ConteudoMarketing['status'];
  versao: number;
  criado_em: string;
  atualizado_em: string;
}

export type CodigoErroMarketing =
  | 'NAO_AUTENTICADO'
  | 'SEM_PERMISSAO'
  | 'WORKSPACE_AMBIGUO'
  | 'CONFLITO'
  | 'INDISPONIVEL';

export class ErroMarketingRemoto extends Error {
  readonly codigo: CodigoErroMarketing;

  constructor(
    message: string,
    codigo: CodigoErroMarketing,
  ) {
    super(message);
    this.name = 'ErroMarketingRemoto';
    this.codigo = codigo;
  }
}

interface ErroSupabase {
  code?: string;
  message?: string;
}

function traduzirErro(erro: ErroSupabase, acao: string): ErroMarketingRemoto {
  if (erro.code === '40001') {
    return new ErroMarketingRemoto(
      'Este briefing foi alterado em outra sessão. Volte à agenda, reabra o item e confira a versão mais recente.',
      'CONFLITO',
    );
  }
  if (erro.code === '42501') {
    return new ErroMarketingRemoto(
      'Sua conta não tem permissão para realizar esta ação no workspace de Marketing.',
      'SEM_PERMISSAO',
    );
  }
  return new ErroMarketingRemoto(
    `Não foi possível ${acao}. Verifique sua conexão e tente novamente.`,
    'INDISPONIVEL',
  );
}

export interface GatewayMarketing {
  obterUsuarioId(): Promise<string | null>;
  listarWorkspaces(): Promise<WorkspaceMarketing[]>;
  criarWorkspace(nome: string, idempotencyKey: string): Promise<WorkspaceMarketing>;
  listarConteudos(workspaceId: string): Promise<LinhaConteudoMarketing[]>;
  buscarConteudo(workspaceId: string, id: string): Promise<LinhaConteudoMarketing | null>;
  criarBriefing(
    workspaceId: string,
    idempotencyKey: string,
    dados: DadosBriefing,
    prepararEstrategia: boolean,
  ): Promise<LinhaConteudoMarketing>;
  atualizarBriefing(
    workspaceId: string,
    id: string,
    versao: number,
    dados: DadosBriefing,
    prepararEstrategia: boolean,
  ): Promise<LinhaConteudoMarketing>;
}

function linhaUnica<T>(valor: T | T[] | null): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor;
}

export function criarGatewaySupabase(cliente: SupabaseClient): GatewayMarketing {
  return {
    async obterUsuarioId() {
      const { data, error } = await cliente.auth.getUser();
      if (error) throw traduzirErro(error, 'validar sua sessão');
      return data.user?.id ?? null;
    },

    async listarWorkspaces() {
      const { data, error } = await cliente
        .from('marketing_workspace')
        .select('id,nome,criado_em')
        .order('criado_em', { ascending: true });
      if (error) throw traduzirErro(error, 'carregar o workspace');
      return (data ?? []) as WorkspaceMarketing[];
    },

    async criarWorkspace(nome, idempotencyKey) {
      const { data, error } = await cliente.rpc('marketing_criar_workspace', {
        p_nome: nome,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw traduzirErro(error, 'preparar o workspace');
      const workspace = linhaUnica(data as WorkspaceMarketing | WorkspaceMarketing[] | null);
      if (!workspace) throw new ErroMarketingRemoto('O workspace não foi retornado pelo banco.', 'INDISPONIVEL');
      return workspace;
    },

    async listarConteudos(workspaceId) {
      const { data, error } = await cliente
        .from('marketing_content_item')
        .select('id,workspace_id,titulo,objetivo,publico,pilar,formato,data_planejada,hipotese,status,versao,criado_em,atualizado_em')
        .eq('workspace_id', workspaceId)
        .order('data_planejada', { ascending: true, nullsFirst: false })
        .order('atualizado_em', { ascending: false });
      if (error) throw traduzirErro(error, 'carregar a agenda');
      return (data ?? []) as LinhaConteudoMarketing[];
    },

    async buscarConteudo(workspaceId, id) {
      const { data, error } = await cliente
        .from('marketing_content_item')
        .select('id,workspace_id,titulo,objetivo,publico,pilar,formato,data_planejada,hipotese,status,versao,criado_em,atualizado_em')
        .eq('workspace_id', workspaceId)
        .eq('id', id)
        .maybeSingle();
      if (error) throw traduzirErro(error, 'abrir o briefing');
      return data as LinhaConteudoMarketing | null;
    },

    async criarBriefing(workspaceId, idempotencyKey, dados, prepararEstrategia) {
      const { data, error } = await cliente.rpc('marketing_criar_briefing_idempotente', {
        p_workspace_id: workspaceId,
        p_idempotency_key: idempotencyKey,
        p_titulo: dados.titulo,
        p_objetivo: dados.objetivo,
        p_publico: dados.publico,
        p_pilar: dados.pilar,
        p_formato: dados.formato,
        p_data_planejada: dados.data_planejada || null,
        p_hipotese: dados.hipotese,
        p_preparar_estrategia: prepararEstrategia,
      });
      if (error) throw traduzirErro(error, 'salvar o briefing');
      const item = linhaUnica(data as LinhaConteudoMarketing | LinhaConteudoMarketing[] | null);
      if (!item) throw new ErroMarketingRemoto('O briefing não foi retornado pelo banco.', 'INDISPONIVEL');
      return item;
    },

    async atualizarBriefing(workspaceId, id, versao, dados, prepararEstrategia) {
      const { data, error } = await cliente.rpc('marketing_atualizar_briefing', {
        p_workspace_id: workspaceId,
        p_content_item_id: id,
        p_versao_esperada: versao,
        p_titulo: dados.titulo,
        p_objetivo: dados.objetivo,
        p_publico: dados.publico,
        p_pilar: dados.pilar,
        p_formato: dados.formato,
        p_data_planejada: dados.data_planejada || null,
        p_hipotese: dados.hipotese,
        p_preparar_estrategia: prepararEstrategia,
      });
      if (error) throw traduzirErro(error, 'atualizar o briefing');
      const item = linhaUnica(data as LinhaConteudoMarketing | LinhaConteudoMarketing[] | null);
      if (!item) throw new ErroMarketingRemoto('O briefing atualizado não foi retornado pelo banco.', 'INDISPONIVEL');
      return item;
    },
  };
}

function mapearConteudo(item: LinhaConteudoMarketing): ConteudoMarketingRemoto {
  return { ...item, data_planejada: item.data_planejada ?? '' };
}

export interface RepositorioMarketingRemoto {
  preparar(): Promise<WorkspaceMarketing>;
  listar(): Promise<ConteudoMarketingRemoto[]>;
  buscar(id: string): Promise<ConteudoMarketingRemoto | null>;
  criar(
    dados: DadosBriefing,
    prepararEstrategia: boolean,
    idempotencyKey: string,
  ): Promise<ConteudoMarketingRemoto>;
  atualizar(
    id: string,
    versao: number,
    dados: DadosBriefing,
    prepararEstrategia: boolean,
  ): Promise<ConteudoMarketingRemoto>;
}

export function criarRepositorioMarketingRemoto(gateway: GatewayMarketing): RepositorioMarketingRemoto {
  let contexto: { usuarioId: string; workspace: WorkspaceMarketing } | null = null;

  async function preparar(): Promise<WorkspaceMarketing> {
    const usuarioId = await gateway.obterUsuarioId();
    if (!usuarioId) {
      contexto = null;
      throw new ErroMarketingRemoto('Entre para acessar o workspace de Marketing.', 'NAO_AUTENTICADO');
    }
    if (contexto?.usuarioId === usuarioId) return contexto.workspace;

    const existentes = await gateway.listarWorkspaces();
    if (existentes.length > 1) {
      throw new ErroMarketingRemoto(
        'Sua conta participa de mais de um workspace. A seleção de workspace precisa ser configurada antes de continuar.',
        'WORKSPACE_AMBIGUO',
      );
    }
    const workspace = existentes[0]
      ?? await gateway.criarWorkspace(NOME_WORKSPACE_INICIAL, CHAVE_WORKSPACE_INICIAL);
    contexto = { usuarioId, workspace };
    return workspace;
  }

  return {
    preparar,
    async listar() {
      const workspace = await preparar();
      return (await gateway.listarConteudos(workspace.id)).map(mapearConteudo);
    },
    async buscar(id) {
      const workspace = await preparar();
      const item = await gateway.buscarConteudo(workspace.id, id);
      return item ? mapearConteudo(item) : null;
    },
    async criar(dados, prepararEstrategia, idempotencyKey) {
      const workspace = await preparar();
      return mapearConteudo(
        await gateway.criarBriefing(workspace.id, idempotencyKey, dados, prepararEstrategia),
      );
    },
    async atualizar(id, versao, dados, prepararEstrategia) {
      const workspace = await preparar();
      return mapearConteudo(
        await gateway.atualizarBriefing(workspace.id, id, versao, dados, prepararEstrategia),
      );
    },
  };
}

let repositorio: RepositorioMarketingRemoto | null = null;

export function obterRepositorioMarketingRemoto(): RepositorioMarketingRemoto {
  if (!repositorio) {
    repositorio = criarRepositorioMarketingRemoto(criarGatewaySupabase(exigirSupabase()));
  }
  return repositorio;
}
