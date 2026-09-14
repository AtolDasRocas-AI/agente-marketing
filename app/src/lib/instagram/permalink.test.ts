import { describe, it, expect } from 'vitest';
import { analisarPermalink, shortcodeDe } from './permalink';

describe('analisarPermalink', () => {
  it('aceita post do feed', () => {
    const r = analisarPermalink('https://www.instagram.com/p/DbtE-tsuEWU/');
    expect(r).toMatchObject({ tipo: 'post', shortcode: 'DbtE-tsuEWU' });
    expect(r.erro).toBeUndefined();
  });

  it('aceita post com query string e sem www', () => {
    expect(analisarPermalink('instagram.com/p/ABC-123_x?igsh=xyz').shortcode).toBe('ABC-123_x');
  });

  it('aceita post no formato /{usuario}/p/{code}', () => {
    expect(analisarPermalink('https://www.instagram.com/atol.ia.oficial/p/DbtE-tsuEWU/').shortcode)
      .toBe('DbtE-tsuEWU');
  });

  it('rejeita reel com mensagem clara (E-21)', () => {
    const r = analisarPermalink('https://www.instagram.com/reel/DcKDUCoOUMX/');
    expect(r.tipo).toBe('reel');
    expect(r.erro).toMatch(/Reels não são suportados/);
  });

  it('rejeita story (E-21)', () => {
    expect(analisarPermalink('https://www.instagram.com/stories/atol/123/').tipo).toBe('story');
  });

  it('rejeita link de outro site (E-20)', () => {
    const r = analisarPermalink('https://facebook.com/post/1');
    expect(r.tipo).toBe('invalido');
    expect(r.erro).toMatch(/Não parece um link do Instagram/);
  });

  it('rejeita entrada vazia (E-20)', () => {
    expect(analisarPermalink('   ').tipo).toBe('invalido');
  });

  it('rejeita perfil sem post', () => {
    expect(analisarPermalink('https://www.instagram.com/atol.ia.oficial/').tipo).toBe('invalido');
  });
});

describe('shortcodeDe', () => {
  it('casa o shortcode de permalinks da API (P-08)', () => {
    expect(shortcodeDe('https://www.instagram.com/p/DbtE-tsuEWU/')).toBe('DbtE-tsuEWU');
    expect(shortcodeDe('https://www.instagram.com/reel/DcKDUCoOUMX/')).toBe('DcKDUCoOUMX');
  });

  it('devolve null para entradas inválidas', () => {
    expect(shortcodeDe(null)).toBeNull();
    expect(shortcodeDe('https://exemplo.com')).toBeNull();
  });
});
