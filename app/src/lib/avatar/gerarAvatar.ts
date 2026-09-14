/**
 * Avatares gerados por username (CAP-11, AC-12).
 * A API oficial não expõe a foto de perfil dos comentaristas, então
 * derivamos um avatar determinístico: mesmo @user = mesmas cores sempre.
 * Puro — sem I/O.
 */

/** FNV-1a 32 bits — hash estável e barato */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export interface Avatar {
  iniciais: string;
  matiz: number;
  gradiente: string;
  corTexto: string;
}

/** Até 2 caracteres representativos do handle (ignora pontos/underscores) */
export function iniciaisDe(username: string): string {
  const limpo = (username ?? '').replace(/^@/, '');
  const partes = limpo.split(/[._-]+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/**
 * Saturação/luminosidade reduzidas em relação à versão inicial para os
 * avatares não brigarem com a paleta oceânica da Atol (handoff, Seção
 * "Avatares"). O matiz — e portanto o determinismo — não muda.
 */
export function gerarAvatar(username: string): Avatar {
  const chave = (username ?? '').replace(/^@/, '').toLowerCase();
  const h = hash(chave);
  const matiz = h % 360;
  const matiz2 = (matiz + 52) % 360;
  return {
    iniciais: iniciaisDe(chave),
    matiz,
    gradiente: `linear-gradient(140deg, hsl(${matiz} 58% 52%), hsl(${matiz2} 54% 40%))`,
    corTexto: 'rgba(255,255,255,0.95)',
  };
}
