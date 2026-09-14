import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icone } from '../../components/Icone';
import { ROTULOS_ESTADO, resumoDoStatus, type ConteudoMarketing } from './model';
import { repositorioLocalMarketing } from './repository';

function rotuloData(data: string) {
  if (!data) return 'Sem data';
  return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short',
  });
}

export function AgendaMarketing() {
  const location = useLocation();
  const navigate = useNavigate();
  const [aviso] = useState(() => (location.state as { aviso?: string } | null)?.aviso);
  const [agenda] = useState<{ itens: ConteudoMarketing[]; erro?: string }>(() => {
    try {
      return { itens: repositorioLocalMarketing.listar() };
    } catch (erro) {
      return {
        itens: [],
        erro: erro instanceof Error ? erro.message : 'Não foi possível carregar a agenda.',
      };
    }
  });
  const { itens } = agenda;

  useEffect(() => {
    if (aviso) navigate(location.pathname, { replace: true, state: null });
  }, [aviso, location.pathname, navigate]);

  const prontos = itens.filter((item) => item.status === 'PRONTO_PARA_ESTRATEGIA').length;

  return (
    <div className="sx-wrap">
      <header className="sx-head sm-head-row">
        <div>
          <p className="ra-eyebrow">ATOL Studio · Marketing</p>
          <h1 className="sx-h1">Agenda de <em>conteúdo</em></h1>
          <p className="sx-lede">
            Transforme ideias em briefings claros antes de envolver IA, imagem ou publicação.
          </p>
        </div>
        <Link to="/marketing/novo" className="sx-btn sx-btn--primary sx-btn--lg">
          <Icone nome="mais" tamanho={16} traco={2} />
          Novo briefing
        </Link>
      </header>

      <div className="sx-note">
        <Icone nome="info" tamanho={16} />
        <span>
          Sprint 1 em modo local: estes rascunhos ficam neste navegador até a fundação de dados
          Marketing ser aplicada e validada.
        </span>
      </div>

      {aviso && <div className="sx-note" role="status">{aviso}</div>}
      {agenda.erro && <div className="sx-note sx-note--warn" role="alert">{agenda.erro}</div>}

      <div className="sx-stats sm-stats">
        <div className="sx-stat sx-stat--hero">
          <div className="sx-stat-n is-teal">{itens.length}</div>
          <div className="sx-stat-l">briefings na agenda</div>
        </div>
        <div className="sx-stat">
          <div className="sx-stat-n">{prontos}</div>
          <div className="sx-stat-l">prontos para estratégia</div>
        </div>
        <div className="sx-stat">
          <div className="sx-stat-n">0</div>
          <div className="sx-stat-l">chamadas de IA</div>
        </div>
      </div>

      <p className="sx-step"><b>Agenda</b> Próximos conteúdos</p>

      {itens.length === 0 ? (
        <div className="sx-empty sx-card">
          <Icone nome="agenda" tamanho={28} />
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22 }}>Comece pelo briefing</h2>
          <p className="sx-hint" style={{ maxWidth: 420, margin: '8px auto 18px' }}>
            Defina a intenção do conteúdo antes de pedir sugestões, gerar imagem ou publicar.
          </p>
          <Link to="/marketing/novo" className="sx-btn sx-btn--primary">Criar primeiro briefing</Link>
        </div>
      ) : (
        <div className="sm-agenda" aria-label="Agenda editorial">
          {itens.map((item) => (
            <article className="sm-item" key={item.id}>
              <div className="sm-item-date">{rotuloData(item.data_planejada)}</div>
              <div className="sm-item-main">
                <div className="sm-item-top">
                  <h2>{item.titulo}</h2>
                  <span className={`sx-tag sx-tag--${resumoDoStatus(item.status)}`}>
                    {ROTULOS_ESTADO[item.status]}
                  </span>
                </div>
                <p>{item.objetivo || 'Objetivo ainda não definido.'}</p>
                <div className="sm-item-meta">
                  <span>{item.formato === 'CARROSSEL' ? 'Carrossel' : 'Feed'}</span>
                  <span>{item.pilar || 'Sem pilar'}</span>
                  <span>{item.publico || 'Público em definição'}</span>
                </div>
                <div className="sm-item-actions">
                  <Link to={`/marketing/briefings/${item.id}`} className="sx-btn sx-btn--ghost">
                    Abrir briefing
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
