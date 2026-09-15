export const ESTADOS_CONTEUDO = [
  'IDEIA',
  'EM_BRIEFING',
  'PRONTO_PARA_ESTRATEGIA',
  'EM_ESTRATEGIA',
  'EM_REVISAO',
  'AGUARDANDO_APROVACAO',
  'APROVADO',
  'PUBLICADO',
] as const;

export type EstadoConteudo = (typeof ESTADOS_CONTEUDO)[number];
export type FormatoConteudo = 'FEED' | 'CARROSSEL';

export interface DadosBriefing {
  titulo: string;
  objetivo: string;
  publico: string;
  pilar: string;
  formato: FormatoConteudo;
  data_planejada: string;
  hipotese: string;
}

export interface ConteudoMarketing extends DadosBriefing {
  id: string;
  status: EstadoConteudo;
  criado_em: string;
  atualizado_em: string;
}

export const ROTULOS_ESTADO: Record<EstadoConteudo, string> = {
  IDEIA: 'Ideia',
  EM_BRIEFING: 'Em briefing',
  PRONTO_PARA_ESTRATEGIA: 'Pronto para estratégia',
  EM_ESTRATEGIA: 'Em estratégia',
  EM_REVISAO: 'Em revisão',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  APROVADO: 'Aprovado',
  PUBLICADO: 'Publicado',
};

export const FORMATOS: Array<{ valor: FormatoConteudo; rotulo: string }> = [
  { valor: 'FEED', rotulo: 'Feed' },
  { valor: 'CARROSSEL', rotulo: 'Carrossel' },
];

const CAMPOS_OBRIGATORIOS: Array<keyof Omit<DadosBriefing, 'formato'>> = [
  'titulo',
  'objetivo',
  'publico',
  'pilar',
  'data_planejada',
  'hipotese',
];

export function validarBriefing(dados: DadosBriefing, completo: boolean): Partial<Record<keyof DadosBriefing, string>> {
  const erros: Partial<Record<keyof DadosBriefing, string>> = {};

  if (dados.titulo.trim().length > 180) {
    erros.titulo = 'Use no máximo 180 caracteres.';
  }
  if (dados.objetivo.length > 4000) erros.objetivo = 'Use no máximo 4.000 caracteres.';
  if (dados.publico.length > 1000) erros.publico = 'Use no máximo 1.000 caracteres.';
  if (dados.pilar.length > 120) erros.pilar = 'Use no máximo 120 caracteres.';
  if (dados.hipotese.length > 4000) erros.hipotese = 'Use no máximo 4.000 caracteres.';

  if (!completo) {
    if (!dados.titulo.trim()) erros.titulo = 'Dê um nome ao rascunho para salvá-lo.';
    return erros;
  }

  for (const campo of CAMPOS_OBRIGATORIOS) {
    if (!dados[campo].trim() && !erros[campo]) erros[campo] = 'Campo obrigatório.';
  }
  return erros;
}

export function estadoAoSalvar(dados: DadosBriefing, completo: boolean): EstadoConteudo {
  if (completo) return 'PRONTO_PARA_ESTRATEGIA';

  const temBriefingEmAndamento = [
    dados.objetivo,
    dados.publico,
    dados.pilar,
    dados.data_planejada,
    dados.hipotese,
  ].some((valor) => valor.trim().length > 0);

  return temBriefingEmAndamento ? 'EM_BRIEFING' : 'IDEIA';
}

export function resumoDoStatus(status: EstadoConteudo): 'ok' | 'warn' | 'extra' {
  if (status === 'APROVADO' || status === 'PUBLICADO') return 'ok';
  if (status === 'PRONTO_PARA_ESTRATEGIA' || status === 'AGUARDANDO_APROVACAO') return 'warn';
  return 'extra';
}

export function dataLocalHoje(): string {
  const agora = new Date();
  const deslocamento = agora.getTimezoneOffset() * 60_000;
  return new Date(agora.getTime() - deslocamento).toISOString().slice(0, 10);
}
