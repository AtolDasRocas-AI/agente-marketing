import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { construirFita, janelaVisivel } from '../../lib/avatar/fita';

export interface ItemRoleta {
  autor_username: string;
}

interface RoletaProps {
  /** pool visual — só aparência, não decide nada */
  participantes: ItemRoleta[];
  /** vencedor JÁ decidido pelo motor determinístico */
  vencedor: string;
  duracao?: number;
  onFim?: () => void;
}

/** 66px por item é o número de que a matemática da fita depende (handoff) */
const ALTURA_ITEM = 66;
const VISIVEIS = 3;

/**
 * Roleta slot machine (CAP-10) — moldura visual `.sx-reel*` do design
 * system, com a lógica de fita virtualizada preservada.
 */
export function Roleta({ participantes, vencedor, duracao = 4600, onFim }: RoletaProps) {
  const reduzirMovimento = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const [girando, setGirando] = useState(!reduzirMovimento);
  const [offset, setOffset] = useState(0);
  const [travado, setTravado] = useState(reduzirMovimento);
  const raf = useRef<number | null>(null);
  const inicio = useRef<number | null>(null);
  const finalizou = useRef(false);

  const fita = useMemo(
    () => construirFita(participantes, vencedor, VISIVEIS),
    [participantes, vencedor]
  );

  useEffect(() => {
    const distanciaFinal = (fita.indiceAlvo - Math.floor(VISIVEIS / 2)) * ALTURA_ITEM;

    function concluir() {
      if (finalizou.current) return;
      finalizou.current = true;
      setOffset(distanciaFinal);
      setGirando(false);
      setTravado(true);
      onFim?.();
    }

    if (reduzirMovimento) {
      concluir();
      return;
    }

    /* Rede de segurança: o navegador congela requestAnimationFrame em aba
       oculta. Sem isso, trocar de aba durante a live deixaria a roleta
       presa em "sorteando" e o vencedor nunca apareceria. */
    const salvaguarda = setTimeout(concluir, duracao + 1500);

    function passo(agora: number) {
      inicio.current ??= agora;
      const t = Math.min((agora - inicio.current) / duracao, 1);
      // desaceleração longa, com suspense
      const eased = 1 - Math.pow(1 - t, 5);
      setOffset(distanciaFinal * eased);
      if (t < 1) raf.current = requestAnimationFrame(passo);
      else concluir();
    }
    raf.current = requestAnimationFrame(passo);

    return () => {
      clearTimeout(salvaguarda);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [fita, duracao, reduzirMovimento, onFim]);

  const {
    itens: janela,
    primeiroIndice: primeiroVisivel,
    deslocamentoInterno,
  } = janelaVisivel(fita, offset, ALTURA_ITEM, VISIVEIS);

  return (
    <div
      className="sx-reel"
      role="status"
      aria-live="polite"
      aria-label={travado ? `Vencedor: ${vencedor}` : 'Sorteando…'}
    >
      <div className="sx-reel-ptr" aria-hidden="true" />
      <div
        className="sx-reel-strip"
        style={{ transform: `translateY(${-deslocamentoInterno}px)`, transition: 'none' }}
      >
        {janela.map((item, i) => {
          const indiceReal = primeiroVisivel + i;
          const ehVencedor = travado && indiceReal === fita.indiceAlvo;
          return (
            <div
              key={`${indiceReal}-${item.autor_username}`}
              className="sx-reel-item"
              style={{
                opacity: girando ? 0.75 : ehVencedor ? 1 : 0.3,
                color: ehVencedor ? 'var(--text)' : undefined,
              }}
            >
              <Avatar username={item.autor_username} />
              @{item.autor_username}
            </div>
          );
        })}
      </div>
    </div>
  );
}
