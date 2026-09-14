import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icone } from '../../components/Icone';
import { buscarSorteio, executarSorteio, listarChances, type SorteioResumo } from './api';
import { mensagemDeErro } from '../../lib/erro';

/**
 * Entrada da semente e confirmação (CAP-08, P-06).
 * A semente precisa ter sido publicada ANTES — é isso que torna o
 * resultado incontestável.
 */
export function Executar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sorteio, setSorteio] = useState<SorteioResumo | null>(null);
  const [totalChances, setTotalChances] = useState<number | null>(null);
  const [semente, setSemente] = useState('');
  const [fonte, setFonte] = useState('Stories do @atol.ia.oficial');
  const [confirmou, setConfirmou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [executando, setExecutando] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([buscarSorteio(id), listarChances(id)])
      .then(([s, chances]) => {
        setSorteio(s);
        setTotalChances(chances.length);
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, [id]);

  async function executar() {
    if (!id) return;
    setExecutando(true);
    setErro(null);
    try {
      await executarSorteio(id, semente.trim(), fonte.trim() || undefined);
      navigate(`/sorteios/${id}/live`);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setExecutando(false);
    }
  }

  if (erro && !sorteio)
    return (
      <div className="sx-wrap--narrow">
        <div className="sx-note sx-note--warn" role="alert">
          <Icone nome="info" tamanho={15} traco={2} />
          <span>{erro}</span>
        </div>
      </div>
    );
  if (!sorteio) return <p className="sx-hint">Carregando…</p>;

  if (sorteio.status === 'SORTEADO')
    return (
      <div className="sx-wrap--narrow">
        <div className="sx-card sx-card--pad" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22 }}>
            Sorteio já executado
          </h2>
          <p className="sx-hint" style={{ margin: '8px auto 18px', maxWidth: '46ch' }}>
            Cada rodada roda uma única vez. Para sortear de novo, crie uma nova rodada no
            mesmo post.
          </p>
          <button className="sx-btn sx-btn--primary" onClick={() => navigate(`/sorteios/${id}/live`)}>
            Ver o resultado
          </button>
        </div>
      </div>
    );

  const pronto = semente.trim().length >= 3 && confirmou && (totalChances ?? 0) > 0;

  return (
    <div className="sx-wrap--narrow">
      <header className="sx-head">
        <p className="ra-eyebrow">Sortear</p>
        <h1 className="sx-h1">
          Congelar a lista e <em>sortear</em>
        </h1>
        <p className="sx-lede">
          A semente precisa ter sido publicada antes — é isso que torna o resultado
          incontestável.
        </p>
      </header>

      <div className="sx-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 18 }}>
        <div className="sx-stat sx-stat--hero">
          <div className="sx-stat-n is-teal">{totalChances ?? '—'}</div>
          <div className="sx-stat-l">chances na urna</div>
        </div>
        <div className="sx-stat">
          <div className="sx-stat-n">{sorteio.qtd_vencedores}</div>
          <div className="sx-stat-l">ganhador{sorteio.qtd_vencedores > 1 ? 'es' : ''}</div>
        </div>
        <div className="sx-stat">
          <div className="sx-stat-n">{sorteio.qtd_suplentes}</div>
          <div className="sx-stat-l">suplente{sorteio.qtd_suplentes === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="sx-card sx-card--pad" style={{ display: 'grid', gap: 18 }}>
        <div className="sx-field">
          <label htmlFor="semente">Semente pública</label>
          <input
            id="semente"
            className="sx-input"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
            value={semente}
            onChange={(e) => setSemente(e.target.value)}
            placeholder="LOTERIA-6789"
          />
          <p className="sx-hint">
            Qualquer texto. O que importa é ter sido publicado antes — ele entra no cálculo
            junto com o hash da lista congelada.
          </p>
        </div>

        <div className="sx-field">
          <label htmlFor="fonte">Onde você publicou</label>
          <input
            id="fonte"
            className="sx-input"
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
          />
        </div>

        <label className="sx-check">
          <input
            type="checkbox"
            checked={confirmou}
            onChange={(e) => setConfirmou(e.target.checked)}
          />
          <span>
            Confirmo que a semente já foi publicada e que o snapshot será congelado agora — a
            importação para e o sorteio roda uma única vez.
          </span>
        </label>

        <div className="sx-note sx-note--warn">
          <Icone nome="cadeado" tamanho={15} traco={2} />
          <span>
            Depois de sortear, esta rodada não roda de novo. Para sortear outra vez, crie uma
            nova rodada no mesmo post.
          </span>
        </div>

        {erro && (
          <div className="sx-note sx-note--warn" role="alert">
            <Icone nome="info" tamanho={15} traco={2} />
            <span>{erro}</span>
          </div>
        )}
      </div>

      <div className="sx-actions">
        <button
          className="sx-btn sx-btn--primary sx-btn--lg"
          disabled={!pronto || executando}
          onClick={executar}
        >
          {executando ? 'Sorteando…' : 'Congelar e sortear'}
        </button>
        <button
          className="sx-btn sx-btn--ghost"
          onClick={() => navigate(`/sorteios/${id}/participantes`)}
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
