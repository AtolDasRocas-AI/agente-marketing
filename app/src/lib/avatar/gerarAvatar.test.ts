import { describe, it, expect } from 'vitest';
import { gerarAvatar, iniciaisDe } from './gerarAvatar';

describe('gerarAvatar — AC-12 (determinismo visual)', () => {
  it('mesmo username produz sempre o mesmo avatar', () => {
    const a = gerarAvatar('atol.ia.oficial');
    for (let i = 0; i < 50; i++) {
      expect(gerarAvatar('atol.ia.oficial')).toEqual(a);
    }
  });

  it('ignora @ e caixa', () => {
    expect(gerarAvatar('@Maria_Silva')).toEqual(gerarAvatar('maria_silva'));
  });

  it('usernames diferentes tendem a cores diferentes', () => {
    const matizes = new Set(
      ['ana', 'bia', 'cid', 'dan', 'eva', 'fab', 'gui', 'hel'].map((u) => gerarAvatar(u).matiz)
    );
    expect(matizes.size).toBeGreaterThanOrEqual(6);
  });

  it('matiz sempre dentro de [0,360)', () => {
    for (const u of ['a', 'zzzzz', 'user.123_x', '🙂']) {
      const { matiz } = gerarAvatar(u);
      expect(matiz).toBeGreaterThanOrEqual(0);
      expect(matiz).toBeLessThan(360);
    }
  });
});

describe('iniciaisDe', () => {
  it('duas partes → primeira letra de cada', () => {
    expect(iniciaisDe('maria.silva')).toBe('MS');
    expect(iniciaisDe('atol_ia_oficial')).toBe('AI');
  });

  it('parte única → dois primeiros caracteres', () => {
    expect(iniciaisDe('reefruivo')).toBe('RE');
  });

  it('trata vazio e handle de 1 letra', () => {
    expect(iniciaisDe('')).toBe('?');
    expect(iniciaisDe('x')).toBe('X');
  });
});
