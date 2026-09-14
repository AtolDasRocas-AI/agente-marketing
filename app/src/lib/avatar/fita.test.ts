import { describe, it, expect } from 'vitest';
import { construirFita, janelaVisivel, COMPRIMENTO_FITA, type ItemFita } from './fita';
import { gerarAvatar } from './gerarAvatar';

function urna(n: number): ItemFita[] {
  return Array.from({ length: n }, (_, i) => ({ autor_username: `participante${i}` }));
}

const VISIVEIS = 5;
const ALTURA = 72;

describe('roleta com urna grande — AC-13', () => {
  it('o tamanho da fita não cresce com a urna (151 vs 15.000)', () => {
    const pequena = construirFita(urna(151), 'vencedor', VISIVEIS);
    const gigante = construirFita(urna(15_000), 'vencedor', VISIVEIS);
    expect(pequena.itens).toHaveLength(COMPRIMENTO_FITA);
    expect(gigante.itens).toHaveLength(COMPRIMENTO_FITA);
  });

  it('a janela no DOM fica em ~7 nós em qualquer posição, com 5.000 participantes', () => {
    const fita = construirFita(urna(5000), 'vencedor', VISIVEIS);
    const totalPercorrido = fita.itens.length * ALTURA;
    for (let d = 0; d <= totalPercorrido; d += ALTURA) {
      const janela = janelaVisivel(fita, d, ALTURA, VISIVEIS);
      expect(janela.itens.length).toBeLessThanOrEqual(VISIVEIS + 2);
    }
  });

  it('o vencedor correto para sob o ponteiro central', () => {
    const fita = construirFita(urna(1200), 'sulyiaronka', VISIVEIS);
    expect(fita.itens[fita.indiceAlvo].autor_username).toBe('sulyiaronka');

    // posição final da animação
    const distanciaFinal = (fita.indiceAlvo - Math.floor(VISIVEIS / 2)) * ALTURA;
    const janela = janelaVisivel(fita, distanciaFinal, ALTURA, VISIVEIS);
    const indiceCentral = fita.indiceAlvo - janela.primeiroIndice;
    expect(janela.itens[indiceCentral].autor_username).toBe('sulyiaronka');
  });

  it('construir a fita com 20.000 participantes é instantâneo', () => {
    const grande = urna(20_000);
    const inicio = performance.now();
    for (let i = 0; i < 50; i++) construirFita(grande, 'vencedor', VISIVEIS);
    const porChamada = (performance.now() - inicio) / 50;
    expect(porChamada).toBeLessThan(5); // ms — longe de causar jank em 16,7ms/quadro
  });

  it('gerar avatares de toda a janela visível também é barato', () => {
    const fita = construirFita(urna(10_000), 'vencedor', VISIVEIS);
    const inicio = performance.now();
    for (let d = 0; d < 3000; d += ALTURA) {
      for (const item of janelaVisivel(fita, d, ALTURA, VISIVEIS).itens) {
        gerarAvatar(item.autor_username);
      }
    }
    expect(performance.now() - inicio).toBeLessThan(50);
  });

  it('urna com 1 participante ainda funciona', () => {
    const fita = construirFita(urna(1), 'participante0', VISIVEIS);
    expect(fita.itens[fita.indiceAlvo].autor_username).toBe('participante0');
  });

  it('urna vazia usa o próprio vencedor como preenchimento', () => {
    const fita = construirFita([], 'unico', VISIVEIS);
    expect(fita.itens.every((i) => i.autor_username === 'unico')).toBe(true);
  });
});
