import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icone } from '../../components/Icone';
import {
  listarSorteios, apagarSorteio, apagarSorteios, buscarResultado,
  type SorteioResumo,
} from '../sorteios/api';
import { mensagemDeErro } from '../../lib/erro';

interface ItemHistorico extends SorteioResumo {
  vencedor?: string | null;
}

const ROTA_POR_STATUS: Record<string, string> = {
  RASCUNHO: 'participantes',
  IMPORTANDO: 'participantes',
  PRONTO: 'executar',
  ENCERRADO: 'executar',
  SORTEADO: 'live',
};

async function buscarItensHistorico(): Promise<ItemHistorico[]> {
  const lista = await listarSorteios();
  return Promise.all(
    lista.map(async (s) => {
      if (s.status !== 'SORTEADO') return s;
      const resultado = await buscarResultado(s.id).catch(() => null);
      return { ...s, vencedor: resultado?.vencedores?.[0]?.autor_username ?? null };
    })
  );
}

export function Historico() {
  const navigate = useNavigate();
  const [itens, setItens] = useState<ItemHistorico[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [confirmandoTudo, setConfirmandoTudo] = useState(false);
  const [textoConfirma, setTextoConfirma] = useState('');

  async function carregar() {
    try {
      setItens(await buscarItensHistorico());
      setErro(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  useEffect(() => {
    let ativo = true;
    buscarItensHistorico()
      .then((lista) => {
        if (ativo) setItens(lista);
      })
      .catch((e) => {
        if (ativo) setErro(mensagemDeErro(e));
      });
    return () => {
      ativo = false;
    };
  }, []);

  async function apagarUm(s: SorteioResumo) {
    if (
      !window.confirm(
        `Apagar "${s.titulo.slice(0, 40)}"?\n\nRemove os comentários importados, a qualificação e o resultado. Não dá para desfazer.`
      )
    )
      return;
    setApagando(s.id);
    setErro(null);
    try {
      await apagarSorteio(s.id);
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setApagando(null);
    }
  }

  async function apagarTudo() {
    if (!itens) return;
    setApagando('TODOS');
    setErro(null);
    try {
      await apagarSorteios(itens.map((s) => s.id));
      setConfirmandoTudo(false);
      setTextoConfirma('');
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setApagando(null);
    }
  }

  if (erro && !itens)
    return (
      <div className="sx-wrap">
        <div className="sx-note sx-note--warn" role="alert">
          <Icone nome="info" tamanho={15} traco={2} />
          {erro}
        </div>
      </div>
    );
  if (!itens) return <p className="sx-hint">Carregando…</p>;

  return (
    <div className="sx-wrap">
      <header className="sx-head">
        <p className="ra-eyebrow">Histórico</p>
        <h1 className="sx-h1">
          Todos os <em>sorteios</em>
        </h1>
        <p className="sx-lede">
          Dados pessoais são expurgados 90 dias após a execução; o comprovante agregado fica
          para sempre.
        </p>
      </header>

      {itens.length === 0 ? (
        <div className="sx-card sx-card--pad sx-empty">
          <Icone nome="historico" tamanho={26} />
          <p style={{ margin: '0 0 16px' }}>Nenhum sorteio ainda.</p>
          <Link to="/sorteios/novo" className="sx-btn sx-btn--primary">
            Escolher um post
          </Link>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex', justifyContent: 'flex-end', marginBottom: 12,
            }}
          >
            <button
              className="sx-btn sx-btn--ghost"
              onClick={() => setConfirmandoTudo((v) => !v)}
              style={{ color: 'var(--danger)' }}
            >
              <Icone nome="lixeira" tamanho={15} traco={2} />
              Apagar todos
            </button>
          </div>

          {confirmandoTudo && (
            <div className="sx-note sx-note--warn" style={{ display: 'block', marginBottom: 14 }}>
              <strong style={{ color: 'var(--warn)' }}>
                Apagar {itens.length} sorteio{itens.length > 1 ? 's' : ''} e todos os dados?
              </strong>
              <p className="sx-hint" style={{ margin: '6px 0 10px' }}>
                Remove comentários, qualificações, chances e comprovantes. Digite{' '}
                <code>APAGAR</code> para confirmar.
              </p>
              <input
                className="sx-input"
                value={textoConfirma}
                onChange={(e) => setTextoConfirma(e.target.value)}
                placeholder="APAGAR"
                autoComplete="off"
                style={{ maxWidth: 220, marginBottom: 10 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="sx-btn"
                  onClick={apagarTudo}
                  disabled={textoConfirma.trim().toUpperCase() !== 'APAGAR' || apagando === 'TODOS'}
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: 'var(--ink)' }}
                >
                  {apagando === 'TODOS' ? 'Apagando…' : 'Apagar tudo'}
                </button>
                <button
                  className="sx-btn sx-btn--ghost"
                  onClick={() => { setConfirmandoTudo(false); setTextoConfirma(''); }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {erro && (
            <div className="sx-note sx-note--warn" role="alert" style={{ marginBottom: 14 }}>
              <Icone nome="info" tamanho={15} traco={2} />
              {erro}
            </div>
          )}

          <div className="sx-hist">
            {itens.map((s) => (
              <div
                key={s.id}
                className="sx-hitem"
                onClick={() => navigate(`/sorteios/${s.id}/${ROTA_POR_STATUS[s.status]}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/sorteios/${s.id}/${ROTA_POR_STATUS[s.status]}`);
                  }
                }}
              >
                <div className="sx-hitem-thumb">
                  <Icone nome="foto" tamanho={18} traco={1.7} />
                </div>
                <div className="sx-hitem-main">
                  <div className="sx-hitem-t">{s.titulo}</div>
                  <div className="sx-hitem-m">
                    {new Date(s.criado_em).toLocaleDateString('pt-BR')} · {s.qtd_vencedores}{' '}
                    ganhador{s.qtd_vencedores > 1 ? 'es' : ''} · {s.qtd_suplentes} suplente
                    {s.qtd_suplentes === 1 ? '' : 's'}
                  </div>
                </div>
                {s.status === 'SORTEADO' && s.vencedor ? (
                  <div className="sx-hitem-w">
                    venceu
                    <br />
                    <b>@{s.vencedor}</b>
                  </div>
                ) : (
                  <span
                    className={`sx-tag ${
                      s.status === 'PRONTO' ? 'sx-tag--ok' : 'sx-tag--warn'
                    }`}
                  >
                    {s.status.toLowerCase()}
                  </span>
                )}
                <button
                  className="sx-btn sx-btn--ghost"
                  onClick={(e) => { e.stopPropagation(); apagarUm(s); }}
                  disabled={apagando === s.id}
                  aria-label={`Apagar ${s.titulo}`}
                  style={{ padding: '8px 10px', color: 'var(--muted-2)' }}
                >
                  <Icone nome="lixeira" tamanho={15} traco={2} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
