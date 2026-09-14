/**
 * Parsing e validação de permalinks do Instagram (CAP-03, E-20, E-21).
 * Puro — sem I/O, testável direto.
 */

export type TipoLink = 'post' | 'reel' | 'story' | 'invalido';

export interface LinkAnalisado {
  tipo: TipoLink;
  shortcode: string | null;
  /** mensagem pronta para exibir quando o link não serve */
  erro?: string;
}

const RE_POST = /instagram\.com\/(?:[^/]+\/)?p\/([A-Za-z0-9_-]+)/;
const RE_REEL = /instagram\.com\/(?:[^/]+\/)?(?:reel|reels)\/([A-Za-z0-9_-]+)/;
const RE_STORY = /instagram\.com\/stories\//;

export function analisarPermalink(entrada: string): LinkAnalisado {
  const texto = (entrada ?? '').trim();
  if (!texto) return { tipo: 'invalido', shortcode: null, erro: 'Cole o link do post.' };

  if (!/instagram\.com/i.test(texto)) {
    return {
      tipo: 'invalido',
      shortcode: null,
      erro: 'Não parece um link do Instagram. Ex.: https://www.instagram.com/p/ABC123/',
    };
  }

  if (RE_STORY.test(texto)) {
    return {
      tipo: 'story',
      shortcode: null,
      erro: 'Stories não têm comentários públicos — use um post do feed.',
    };
  }

  const reel = texto.match(RE_REEL);
  if (reel) {
    return {
      tipo: 'reel',
      shortcode: reel[1],
      erro: 'Reels não são suportados nesta versão — use um post do feed (/p/).',
    };
  }

  const post = texto.match(RE_POST);
  if (post) return { tipo: 'post', shortcode: post[1] };

  return {
    tipo: 'invalido',
    shortcode: null,
    erro: 'Link do Instagram sem código de post. Ex.: https://www.instagram.com/p/ABC123/',
  };
}

/** Extrai o shortcode de qualquer permalink (usado para casar com /me/media) */
export function shortcodeDe(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = String(url).match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
