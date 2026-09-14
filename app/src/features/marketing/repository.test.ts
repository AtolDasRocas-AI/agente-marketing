import { describe, expect, it } from 'vitest';
import { criarRepositorioMarketing, ErroRepositorioMarketing } from './repository';
import type { DadosBriefing } from './model';

const dados: DadosBriefing = {
  titulo: 'Guia de corais', objetivo: '', publico: '', pilar: '', formato: 'CARROSSEL',
  data_planejada: '', hipotese: '',
};

function armazenamentoFake(inicial: string | null = null) {
  let valor = inicial;
  return {
    getItem: () => valor,
    setItem: (_chave: string, novoValor: string) => { valor = novoValor; },
  };
}

function itemSerializado(sobrescrever: Record<string, unknown> = {}) {
  return JSON.stringify([{
    ...dados,
    id: 'item-1',
    status: 'IDEIA',
    criado_em: '2026-09-13T12:00:00.000Z',
    atualizado_em: '2026-09-13T12:00:00.000Z',
    ...sobrescrever,
  }]);
}

describe('repositório local de Marketing', () => {
  it('cria e reencontra um briefing', () => {
    const storage = armazenamentoFake();
    const repositorio = criarRepositorioMarketing(() => storage);
    const criado = repositorio.criar(dados, 'IDEIA');

    expect(repositorio.buscar(criado.id)).toEqual(criado);
    expect(repositorio.listar()).toHaveLength(1);
  });

  it('atualiza sem duplicar e preserva identidade e criação', () => {
    const storage = armazenamentoFake();
    const repositorio = criarRepositorioMarketing(() => storage);
    const criado = repositorio.criar(dados, 'IDEIA');
    const atualizado = repositorio.atualizar(
      criado.id,
      { ...dados, objetivo: 'Aumentar salvamentos' },
      'EM_BRIEFING',
    );

    expect(repositorio.listar()).toHaveLength(1);
    expect(atualizado.id).toBe(criado.id);
    expect(atualizado.criado_em).toBe(criado.criado_em);
    expect(atualizado.objetivo).toBe('Aumentar salvamentos');
    expect(atualizado.status).toBe('EM_BRIEFING');
  });

  it('não converte dados inválidos em agenda vazia', () => {
    const repositorio = criarRepositorioMarketing(() => armazenamentoFake('{"invalido":true}'));
    expect(() => repositorio.listar()).toThrow(ErroRepositorioMarketing);
  });

  it('rejeita formato e status fora do domínio', () => {
    const formatoInvalido = criarRepositorioMarketing(
      () => armazenamentoFake(itemSerializado({ formato: 'VIDEO' })),
    );
    const statusInvalido = criarRepositorioMarketing(
      () => armazenamentoFake(itemSerializado({ status: 'DESCONHECIDO' })),
    );
    expect(() => formatoInvalido.listar()).toThrow(ErroRepositorioMarketing);
    expect(() => statusInvalido.listar()).toThrow(ErroRepositorioMarketing);
  });

  it('informa quando o armazenamento não está disponível', () => {
    const repositorio = criarRepositorioMarketing(() => null);
    expect(() => repositorio.listar()).toThrow(/não está disponível/i);
  });

  it('retorna nulo para item inexistente', () => {
    const repositorio = criarRepositorioMarketing(() => armazenamentoFake());
    expect(repositorio.buscar('inexistente')).toBeNull();
  });

  it('ordena primeiro por data planejada e depois por atualização', () => {
    const itens = [
      JSON.parse(itemSerializado({ id: 'tarde', data_planejada: '2026-09-22' }))[0],
      JSON.parse(itemSerializado({ id: 'cedo', data_planejada: '2026-09-20' }))[0],
    ];
    const repositorio = criarRepositorioMarketing(() => armazenamentoFake(JSON.stringify(itens)));
    expect(repositorio.listar().map((item) => item.id)).toEqual(['cedo', 'tarde']);
  });

  it('informa a falha de gravação sem perder os dados recebidos', () => {
    const repositorio = criarRepositorioMarketing(() => ({
      getItem: () => null,
      setItem: () => { throw new Error('quota'); },
    }));
    expect(() => repositorio.criar(dados, 'IDEIA')).toThrow(/formulário continua preenchido/i);
  });
});
