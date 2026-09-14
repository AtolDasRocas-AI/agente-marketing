/**
 * Construção da fita da roleta — PURA, para poder ser testada.
 *
 * O ponto crítico de performance (AC-13): o número de itens da fita
 * NÃO cresce com o tamanho da urna. Com 151 ou 15.000 participantes,
 * a fita tem o mesmo tamanho e a janela visível é sempre ~7 nós no DOM.
 */

export interface ItemFita {
  autor_username: string;
}

export interface Fita {
  itens: ItemFita[];
  /** índice onde o vencedor está posicionado (ponto de parada) */
  indiceAlvo: number;
}

/** Itens que a fita usa para dar a sensação de giro, independente da urna */
export const COMPRIMENTO_FITA = 120;

export function construirFita(
  participantes: ItemFita[],
  vencedor: string,
  visiveis: number
): Fita {
  const base = participantes.length ? participantes : [{ autor_username: vencedor }];

  // amostra ciclando a urna — comprimento fixo, custo O(COMPRIMENTO_FITA)
  const itens: ItemFita[] = Array.from(
    { length: COMPRIMENTO_FITA },
    (_, i) => base[i % base.length]
  );

  // o vencedor precisa cair exatamente sob o ponteiro central no fim
  const indiceAlvo = itens.length - Math.floor(visiveis / 2) - 1;
  itens[indiceAlvo] = { autor_username: vencedor };

  return { itens, indiceAlvo };
}

/** Recorte visível da fita numa dada posição — o que realmente vai ao DOM */
export function janelaVisivel(
  fita: Fita,
  deslocamento: number,
  alturaItem: number,
  visiveis: number
): { itens: ItemFita[]; primeiroIndice: number; deslocamentoInterno: number } {
  const primeiroIndice = Math.max(0, Math.floor(deslocamento / alturaItem) - 1);
  return {
    itens: fita.itens.slice(primeiroIndice, primeiroIndice + visiveis + 2),
    primeiroIndice,
    deslocamentoInterno: deslocamento - primeiroIndice * alturaItem,
  };
}
