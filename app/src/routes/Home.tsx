import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { listarSorteios, type SorteioResumo } from '../features/sorteios/api';
import { useContaConectada } from '../features/conta/useContaConectada';

const COMO_FUNCIONA = [
  {
    n: '01',
    titulo: 'Escolha o post',
    texto: 'A API oficial resolve a mídia e traz os comentários em lotes, sem scraping.',
  },
  {
    n: '02',
    titulo: 'Regras claras',
    texto: 'Menções mínimas, palavra-chave, chances por pessoa ou por comentário.',
  },
  {
    n: '03',
    titulo: 'Semente pública',
    texto: 'Você publica a semente antes. Ela entra no cálculo junto com o hash da lista congelada.',
  },
  {
    n: '04',
    titulo: 'Prova reproduzível',
    texto: 'Comprovante para stories, CSV e um verificador que qualquer um roda.',
  },
];

const ROTA_POR_STATUS: Record<string, string> = {
  RASCUNHO: 'participantes',
  IMPORTANDO: 'participantes',
  PRONTO: 'executar',
  ENCERRADO: 'executar',
};

export function Home() {
  const navigate = useNavigate();
  const { conta, diasParaExpirar } = useContaConectada();
  const [sorteios, setSorteios] = useState<SorteioResumo[] | null>(null);
  const [semSessao, setSemSessao] = useState(false);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setSemSessao(true);
        return;
      }
      listarSorteios()
        .then(setSorteios)
        .catch(() => setSorteios([]));
    })();
  }, []);

  const realizados = (sorteios ?? []).filter((s) => s.status === 'SORTEADO').length;
  const pendente = (sorteios ?? []).find((s) => s.status !== 'SORTEADO') ?? null;

  return (
    <div className="sx-wrap">
      <header className="sx-head">
        <p className="ra-eyebrow">Sorteio ATOL</p>
        <h1 className="sx-h1">
          Sorteios do Instagram,
          <br />
          <em>auditáveis</em> de ponta a ponta
        </h1>
        <p className="sx-lede">
          Escolha o post, importe os comentários pela API oficial e sorteie com prova
          criptográfica — qualquer participante recalcula o vencedor com a semente publicada.
        </p>
      </header>

      {semSessao ? (
        <div className="sx-card sx-card--pad">
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20 }}>
            Entre para começar
          </h2>
          <p className="sx-hint" style={{ margin: '6px 0 16px' }}>
            Acesso restrito ao organizador.
          </p>
          <Link to="/login" className="sx-btn sx-btn--primary">
            Entrar
          </Link>
        </div>
      ) : (
        <>
          <div className="sx-stats">
            <div className="sx-stat sx-stat--hero">
              <div className="sx-stat-n is-teal">{realizados}</div>
              <div className="sx-stat-l">sorteios realizados</div>
            </div>
            <div className="sx-stat">
              <div className="sx-stat-n">{sorteios?.length ?? '—'}</div>
              <div className="sx-stat-l">rodadas criadas</div>
            </div>
            <div className="sx-stat">
              <div className="sx-stat-n">0</div>
              <div className="sx-stat-l">resultados contestados</div>
            </div>
            <div className="sx-stat">
              <div className="sx-stat-n">
                {diasParaExpirar === null ? '—' : `${diasParaExpirar}d`}
              </div>
              <div className="sx-stat-l">token válido</div>
            </div>
          </div>

          <p className="sx-step">
            <b>01</b> Próximo passo
          </p>

          {!conta ? (
            <div className="sx-card sx-card--pad" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20 }}>
                  Vincule o Instagram
                </div>
                <p className="sx-hint">
                  A vinculação acontece uma vez. Depois disso você só escolhe o post.
                </p>
              </div>
              <Link to="/conectar" className="sx-btn sx-btn--primary sx-btn--lg">
                Conectar conta
              </Link>
            </div>
          ) : pendente ? (
            <div className="sx-card sx-card--pad" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20 }}>
                  {pendente.titulo}
                </div>
                <p className="sx-hint">
                  {pendente.status === 'PRONTO'
                    ? 'Comentários importados e regras aplicadas · aguardando a semente ser publicada.'
                    : 'Rodada em andamento — confira os participantes.'}
                </p>
              </div>
              <button
                className="sx-btn sx-btn--primary sx-btn--lg"
                onClick={() =>
                  navigate(`/sorteios/${pendente.id}/${ROTA_POR_STATUS[pendente.status] ?? 'participantes'}`)
                }
              >
                {pendente.status === 'PRONTO' ? 'Sortear agora' : 'Continuar'}
              </button>
            </div>
          ) : (
            <div className="sx-card sx-card--pad" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20 }}>
                  Nada pendente
                </div>
                <p className="sx-hint">Escolha um post para abrir a próxima rodada.</p>
              </div>
              <Link to="/sorteios/novo" className="sx-btn sx-btn--primary sx-btn--lg">
                Novo sorteio
              </Link>
            </div>
          )}
        </>
      )}

      <p className="sx-step">
        <b>02</b> Como funciona
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        {COMO_FUNCIONA.map((c) => (
          <div key={c.n} className="sx-card">
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: 'var(--teal)',
                marginBottom: 8,
              }}
            >
              {c.n}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{c.titulo}</div>
            <p className="sx-hint" style={{ marginTop: 4 }}>
              {c.texto}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
