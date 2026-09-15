import { describe, expect, it, vi } from 'vitest';
import type { DadosBriefing } from './model';
import {
  criarRepositorioMarketingRemoto,
  ErroMarketingRemoto,
  type GatewayMarketing,
  type LinhaConteudoMarketing,
  type WorkspaceMarketing,
} from './repositoryRemote';

const workspace: WorkspaceMarketing = {
  id: 'workspace-1',
  nome: 'ATOL Marketing',
  criado_em: '2026-09-14T12:00:00.000Z',
};

const dados: DadosBriefing = {
  titulo: 'Guia de corais',
  objetivo: 'Aumentar salvamentos',
  publico: 'Aquaristas iniciantes',
  pilar: 'Educação',
  formato: 'CARROSSEL',
  data_planejada: '2026-09-20',
  hipotese: 'Um checklist simples aumenta os salvamentos.',
};

const linha: LinhaConteudoMarketing = {
  ...dados,
  id: 'conteudo-1',
  workspace_id: workspace.id,
  data_planejada: dados.data_planejada,
  status: 'PRONTO_PARA_ESTRATEGIA',
  versao: 2,
  criado_em: '2026-09-14T12:00:00.000Z',
  atualizado_em: '2026-09-14T13:00:00.000Z',
};

function gatewayFake(sobrescrever: Partial<GatewayMarketing> = {}): GatewayMarketing {
  return {
    obterUsuarioId: vi.fn(async () => 'usuario-1'),
    listarWorkspaces: vi.fn(async () => [workspace]),
    criarWorkspace: vi.fn(async () => workspace),
    listarConteudos: vi.fn(async () => [linha]),
    buscarConteudo: vi.fn(async () => linha),
    criarBriefing: vi.fn(async () => linha),
    atualizarBriefing: vi.fn(async () => linha),
    ...sobrescrever,
  };
}

describe('repositório remoto de Marketing', () => {
  it('exige usuário autenticado antes de acessar qualquer workspace', async () => {
    const gateway = gatewayFake({ obterUsuarioId: vi.fn(async () => null) });
    const repositorio = criarRepositorioMarketingRemoto(gateway);

    await expect(repositorio.preparar()).rejects.toMatchObject<Partial<ErroMarketingRemoto>>({
      codigo: 'NAO_AUTENTICADO',
    });
    expect(gateway.listarWorkspaces).not.toHaveBeenCalled();
  });

  it('reutiliza o primeiro workspace ao listar a agenda', async () => {
    const gateway = gatewayFake();
    const repositorio = criarRepositorioMarketingRemoto(gateway);

    const itens = await repositorio.listar();

    expect(gateway.criarWorkspace).not.toHaveBeenCalled();
    expect(gateway.listarConteudos).toHaveBeenCalledWith(workspace.id);
    expect(itens[0]).toMatchObject({ id: linha.id, versao: 2, data_planejada: '2026-09-20' });
  });

  it('cria o workspace inicial de forma idempotente quando não existe nenhum', async () => {
    const gateway = gatewayFake({ listarWorkspaces: vi.fn(async () => []) });
    const repositorio = criarRepositorioMarketingRemoto(gateway);

    await repositorio.preparar();
    await repositorio.preparar();

    expect(gateway.criarWorkspace).toHaveBeenCalledTimes(1);
    expect(gateway.criarWorkspace).toHaveBeenCalledWith('ATOL Marketing', expect.any(String));
  });

  it('não escolhe silenciosamente quando o usuário participa de mais de um workspace', async () => {
    const gateway = gatewayFake({
      listarWorkspaces: vi.fn(async () => [workspace, { ...workspace, id: 'workspace-2' }]),
    });
    const repositorio = criarRepositorioMarketingRemoto(gateway);

    await expect(repositorio.preparar()).rejects.toMatchObject<Partial<ErroMarketingRemoto>>({
      codigo: 'WORKSPACE_AMBIGUO',
    });
    expect(gateway.listarConteudos).not.toHaveBeenCalled();
  });

  it('normaliza data nula recebida do banco para o formulário', async () => {
    const gateway = gatewayFake({
      buscarConteudo: vi.fn(async () => ({ ...linha, data_planejada: null })),
    });
    const repositorio = criarRepositorioMarketingRemoto(gateway);

    await expect(repositorio.buscar(linha.id)).resolves.toMatchObject({ data_planejada: '' });
  });

  it('encaminha criação e atualização somente pelas RPCs protegidas', async () => {
    const gateway = gatewayFake();
    const repositorio = criarRepositorioMarketingRemoto(gateway);

    await repositorio.criar(dados, true, '44444444-4444-4444-8444-444444444444');
    await repositorio.atualizar(linha.id, linha.versao, dados, false);

    expect(gateway.criarBriefing).toHaveBeenCalledWith(
      workspace.id,
      '44444444-4444-4444-8444-444444444444',
      dados,
      true,
    );
    expect(gateway.atualizarBriefing).toHaveBeenCalledWith(
      workspace.id,
      linha.id,
      linha.versao,
      dados,
      false,
    );
  });
});
