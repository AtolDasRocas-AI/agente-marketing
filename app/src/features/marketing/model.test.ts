import { describe, expect, it } from 'vitest';
import { estadoAoSalvar, validarBriefing, type DadosBriefing } from './model';

const completo: DadosBriefing = {
  titulo: 'Como escolher um coral para iniciantes',
  objetivo: 'Aumentar salvamentos',
  publico: 'Aquaristas iniciantes',
  pilar: 'Educação',
  formato: 'CARROSSEL',
  data_planejada: '2026-09-20',
  hipotese: 'Um checklist simples aumenta os salvamentos.',
};

describe('briefing de Marketing', () => {
  it('aceita um briefing completo para estratégia', () => {
    expect(validarBriefing(completo, true)).toEqual({});
    expect(estadoAoSalvar(completo, true)).toBe('PRONTO_PARA_ESTRATEGIA');
  });

  it('classifica rascunho apenas com título como ideia', () => {
    const ideia: DadosBriefing = {
      titulo: 'Nova ideia', objetivo: '', publico: '', pilar: '', formato: 'CARROSSEL',
      data_planejada: '', hipotese: '',
    };
    expect(validarBriefing(ideia, false)).toEqual({});
    expect(estadoAoSalvar(ideia, false)).toBe('IDEIA');
  });

  it('classifica rascunho parcialmente preenchido como em briefing', () => {
    expect(estadoAoSalvar({ ...completo, hipotese: '' }, false)).toBe('EM_BRIEFING');
  });

  it('expõe os campos faltantes ao concluir', () => {
    const erros = validarBriefing({ ...completo, publico: ' ', hipotese: '' }, true);
    expect(erros.publico).toBeDefined();
    expect(erros.hipotese).toBeDefined();
  });

  it('limita o título a 180 caracteres', () => {
    expect(validarBriefing({ ...completo, titulo: 'a'.repeat(181) }, false).titulo).toBeDefined();
  });
});
