import { describe, expect, it } from 'vitest';
import { calcularTendenciaSemanal, mediana, type PontoContaDiaria } from './tendenciaConta';

function diasAtras(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

function serieDe(valoresPorDiaAtras: number[]): PontoContaDiaria[] {
  return valoresPorDiaAtras.map((valor, i) => ({ data: diasAtras(i), metricas: { reach: valor } }));
}

describe('mediana', () => {
  it('calcula a mediana de uma lista ímpar', () => {
    expect(mediana([3, 1, 2])).toBe(2);
  });
  it('calcula a mediana de uma lista par como a média dos dois centrais', () => {
    expect(mediana([10, 20, 30, 40])).toBe(25);
  });
});

describe('calcularTendenciaSemanal', () => {
  it('marca semana anterior e mediana como indisponíveis com menos de 8 dias de histórico', () => {
    const resultado = calcularTendenciaSemanal(serieDe([100, 100, 100, 100, 100, 100, 100]));
    expect(resultado.semanaAtual).toBe(700);
    expect(resultado.semanaAnterior).toBeNull();
    expect(resultado.medianaQuatroSemanas).toBeNull();
    expect(resultado.semanasDisponiveis).toBe(1);
  });

  it('soma a semana atual e a anterior separadamente, sem misturar os dois períodos', () => {
    const valores = [...Array(7).fill(50), ...Array(7).fill(20)];
    const resultado = calcularTendenciaSemanal(serieDe(valores));
    expect(resultado.semanaAtual).toBe(350);
    expect(resultado.semanaAnterior).toBe(140);
  });

  it('calcula a mediana de 4 semanas só quando há pelo menos 2 semanas completas', () => {
    const valores = [...Array(7).fill(10), ...Array(7).fill(90)];
    const comDuasSemanas = calcularTendenciaSemanal(serieDe(valores));
    expect(comDuasSemanas.medianaQuatroSemanas).toBe(mediana([70, 630]));

    const valoresQuatroSemanas = [...Array(7).fill(10), ...Array(7).fill(20), ...Array(7).fill(30), ...Array(7).fill(40)];
    const comQuatroSemanas = calcularTendenciaSemanal(serieDe(valoresQuatroSemanas));
    expect(comQuatroSemanas.semanasDisponiveis).toBe(4);
    expect(comQuatroSemanas.medianaQuatroSemanas).toBe(mediana([70, 140, 210, 280]));
  });

  it('trata reach ausente como zero na soma, nunca lança', () => {
    const serie: PontoContaDiaria[] = [{ data: diasAtras(0), metricas: {} }, { data: diasAtras(1), metricas: { reach: 50 } }];
    const resultado = calcularTendenciaSemanal(serie);
    expect(resultado.semanaAtual).toBe(50);
  });

  it('devolve a série em ordem cronológica (mais antigo primeiro) para o gráfico', () => {
    const resultado = calcularTendenciaSemanal(serieDe([10, 20, 30]));
    expect(resultado.serie.map((p) => p.valor)).toEqual([30, 20, 10]);
  });
});
