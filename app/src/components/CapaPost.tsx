import { useState } from 'react';
import { Icone, type NomeIcone } from './Icone';

export interface MidiaComCapa {
  media_type: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  children?: { data?: Array<{ media_url?: string; thumbnail_url?: string; media_type?: string }> };
}

const ICONE_TIPO: Record<string, NomeIcone> = { IMAGE: 'foto', VIDEO: 'video', CAROUSEL_ALBUM: 'carrossel' };
const ROTULO_TIPO: Record<string, string> = { IMAGE: 'foto', VIDEO: 'vídeo', CAROUSEL_ALBUM: 'carrossel' };

/**
 * Capa correta para cada tipo de mídia:
 * VIDEO usa thumbnail_url (media_url é o arquivo de vídeo);
 * CAROUSEL_ALBUM não tem capa própria — usa o primeiro filho.
 */
export function capaDaMidia(m: MidiaComCapa): string | null {
  if (m.media_type === 'VIDEO') return m.thumbnail_url ?? null;

  if (m.media_type === 'CAROUSEL_ALBUM') {
    const primeiro = m.children?.data?.[0];
    const capaFilho =
      primeiro?.media_type === 'VIDEO'
        ? primeiro?.thumbnail_url
        : (primeiro?.media_url ?? primeiro?.thumbnail_url);
    return capaFilho ?? m.media_url ?? null;
  }

  return m.media_url ?? m.thumbnail_url ?? null;
}

/** Capa do post; as URLs da CDN do Instagram expiram, então o fallback é obrigatório */
export function CapaPost({ midia }: { midia: MidiaComCapa }) {
  const [falhou, setFalhou] = useState(false);
  const capa = capaDaMidia(midia);

  if (!capa || falhou) {
    return (
      <div className="sx-post-img">
        <Icone nome={ICONE_TIPO[midia.media_type] ?? 'foto'} tamanho={22} traco={1.7} />
        {ROTULO_TIPO[midia.media_type] ?? 'post'}
      </div>
    );
  }
  return (
    <div className="sx-post-img" style={{ padding: 0 }}>
      <img
        src={capa}
        alt=""
        loading="lazy"
        onError={() => setFalhou(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}
