import {
  ESTADOS_CONTEUDO, type ConteudoMarketing, type DadosBriefing, type EstadoConteudo,
} from './model';

const CHAVE_STORAGE = 'atol-studio.marketing.conteudos.v1';

export interface RepositorioMarketing {
  listar(): ConteudoMarketing[];
  buscar(id: string): ConteudoMarketing | null;
  criar(dados: DadosBriefing, status: EstadoConteudo): ConteudoMarketing;
  atualizar(id: string, dados: DadosBriefing, status: EstadoConteudo): ConteudoMarketing;
}

interface ArmazenamentoLocal {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

export class ErroRepositorioMarketing extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroRepositorioMarketing';
  }
}

function idLocal(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function eConteudoMarketing(valor: unknown): valor is ConteudoMarketing {
  if (!valor || typeof valor !== 'object') return false;
  const item = valor as Record<string, unknown>;
  const camposTextoValidos = [
    'id', 'titulo', 'objetivo', 'publico', 'pilar', 'formato', 'data_planejada',
    'hipotese', 'status', 'criado_em', 'atualizado_em',
  ].every((campo) => typeof item[campo] === 'string');

  if (!camposTextoValidos) return false;
  const formatoValido = item.formato === 'FEED' || item.formato === 'CARROSSEL';
  const statusValido = ESTADOS_CONTEUDO.includes(item.status as EstadoConteudo);
  const dataPlanejadaValida = item.data_planejada === ''
    || /^\d{4}-\d{2}-\d{2}$/.test(item.data_planejada as string);
  const timestampsValidos = [item.criado_em, item.atualizado_em]
    .every((data) => !Number.isNaN(Date.parse(data as string)));

  return Boolean(
    item.id
    && item.titulo
    && (item.titulo as string).length <= 180
    && formatoValido
    && statusValido
    && dataPlanejadaValida
    && timestampsValidos
  );
}

function armazenamentoDoNavegador(): ArmazenamentoLocal | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function criarRepositorioMarketing(
  obterArmazenamento: () => ArmazenamentoLocal | null,
  chave = CHAVE_STORAGE,
): RepositorioMarketing {
  function armazenamento(): ArmazenamentoLocal {
    const atual = obterArmazenamento();
    if (!atual) {
      throw new ErroRepositorioMarketing('O armazenamento local não está disponível neste navegador.');
    }
    return atual;
  }

  function ler(): ConteudoMarketing[] {
    try {
      const valor = armazenamento().getItem(chave);
      const itens: unknown = valor ? JSON.parse(valor) : [];
      if (!Array.isArray(itens) || !itens.every(eConteudoMarketing)) {
        throw new Error('Formato inválido');
      }
      return itens;
    } catch (erro) {
      if (erro instanceof ErroRepositorioMarketing) throw erro;
      throw new ErroRepositorioMarketing(
        'Não foi possível ler os briefings salvos. Seus dados não foram substituídos.',
      );
    }
  }

  function gravar(itens: ConteudoMarketing[]) {
    try {
      armazenamento().setItem(chave, JSON.stringify(itens));
    } catch {
      throw new ErroRepositorioMarketing(
        'Não foi possível salvar neste navegador. O formulário continua preenchido para você tentar novamente.',
      );
    }
  }

  function ordenar(itens: ConteudoMarketing[]) {
    return [...itens].sort((a, b) => {
      const dataA = a.data_planejada || '9999-12-31';
      const dataB = b.data_planejada || '9999-12-31';
      return dataA.localeCompare(dataB) || b.atualizado_em.localeCompare(a.atualizado_em);
    });
  }

  return {
    listar() {
      return ordenar(ler());
    },

    buscar(id) {
      return ler().find((item) => item.id === id) ?? null;
    },

    criar(dados, status) {
      const agora = new Date().toISOString();
      const item: ConteudoMarketing = {
        ...dados, id: idLocal(), status, criado_em: agora, atualizado_em: agora,
      };
      gravar([item, ...ler()]);
      return item;
    },

    atualizar(id, dados, status) {
      const itens = ler();
      const indice = itens.findIndex((item) => item.id === id);
      if (indice < 0) throw new ErroRepositorioMarketing('Este briefing não foi encontrado.');

      const item: ConteudoMarketing = {
        ...itens[indice], ...dados, id, status, atualizado_em: new Date().toISOString(),
      };
      itens[indice] = item;
      gravar(itens);
      return item;
    },
  };
}

export const repositorioLocalMarketing = criarRepositorioMarketing(armazenamentoDoNavegador);
