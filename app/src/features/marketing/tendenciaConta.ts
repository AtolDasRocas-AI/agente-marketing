export interface PontoContaDiaria { data: string; metricas: { reach?: number } }
export interface TendenciaSemanal {
  semanaAtual: number;
  semanaAnterior: number | null;
  medianaQuatroSemanas: number | null;
  semanasDisponiveis: number;
  serie: { rotulo: string; valor: number }[];
}

export function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

/**
 * Calcula a tendência de alcance a partir da série diária de conta.
 * `diariaDesc` deve vir ordenada do dia mais recente para o mais antigo (mesma ordem
 * que `order('data', { ascending: false })` já traz do banco).
 */
export function calcularTendenciaSemanal(diariaDesc: PontoContaDiaria[]): TendenciaSemanal {
  const somaJanela = (inicio: number, fim: number) =>
    diariaDesc.slice(inicio, fim).reduce((soma, dia) => soma + Number(dia.metricas.reach ?? 0), 0);
  const semanaAtual = somaJanela(0, 7);
  const semanaAnterior = diariaDesc.length > 7 ? somaJanela(7, 14) : null;
  const somasSemanaisDisponiveis = [0, 1, 2, 3]
    .filter((i) => diariaDesc.length > i * 7)
    .map((i) => somaJanela(i * 7, i * 7 + 7));
  const medianaQuatroSemanas = somasSemanaisDisponiveis.length >= 2 ? mediana(somasSemanaisDisponiveis) : null;
  const serie = [...diariaDesc].reverse().map((dia) => ({
    rotulo: new Date(dia.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    valor: Number(dia.metricas.reach ?? 0),
  }));
  return { semanaAtual, semanaAnterior, medianaQuatroSemanas, semanasDisponiveis: somasSemanaisDisponiveis.length, serie };
}
