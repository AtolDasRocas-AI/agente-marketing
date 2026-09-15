import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icone, type NomeIcone } from '../components/Icone';
import { useContaConectada } from '../features/conta/useContaConectada';

interface Destino {
  para: string;
  rotulo: string;
  icone: NomeIcone;
  /** rotas que também acendem este item */
  prefixo?: string;
  excluirPrefixos?: string[];
}

const SORTEIOS: Destino[] = [
  { para: '/', rotulo: 'Início', icone: 'inicio' },
  { para: '/sorteios/novo', rotulo: 'Novo sorteio', icone: 'novo' },
  {
    para: '/historico', rotulo: 'Sorteios', icone: 'pessoas', prefixo: '/sorteios/',
    excluirPrefixos: ['/sorteios/novo'],
  },
];

const MARKETING: Destino[] = [
  { para: '/marketing/agenda', rotulo: 'Agenda', icone: 'agenda', prefixo: '/marketing/', excluirPrefixos: ['/marketing/metricas', '/marketing/relatorio'] },
  { para: '/marketing/metricas', rotulo: 'Métricas', icone: 'historico', prefixo: '/marketing/metricas' },
  { para: '/marketing/relatorio', rotulo: 'Relatório', icone: 'comprovante', prefixo: '/marketing/relatorio' },
];

const GERAL: Destino[] = [
  { para: '/conectar', rotulo: 'Conta', icone: 'conta' },
];

/** Shell da aplicação: topbar + rail lateral (colapsa em mobile) */
export function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const main = useRef<HTMLElement>(null);
  const { conta, diasParaExpirar } = useContaConectada();
  const emMarketing = pathname.startsWith('/marketing');

  // ao trocar de tela, volta o scroll do main ao topo
  useEffect(() => {
    main.current?.scrollTo({ top: 0 });
  }, [pathname]);

  function itemAtivo(d: Destino): boolean {
    if (d.para === '/') return pathname === '/';
    if (pathname.startsWith(d.para)) return true;
    if (d.excluirPrefixos?.some((prefixo) => pathname.startsWith(prefixo))) return false;
    return Boolean(d.prefixo && pathname.startsWith(d.prefixo));
  }

  function renderItem(d: Destino) {
    const ativo = itemAtivo(d);
    return (
      <Link
        key={d.para}
        to={d.para}
        className={`sx-rail-item${ativo ? ' is-active' : ''}`}
        aria-current={ativo ? 'page' : undefined}
        aria-label={d.rotulo}
      >
        <Icone nome={d.icone} />
        <span>{d.rotulo}</span>
      </Link>
    );
  }

  const statusToken =
    diasParaExpirar === null ? null : diasParaExpirar <= 0 ? 'out' : diasParaExpirar < 7 ? 'warn' : 'ok';

  return (
    <div className="sx-app">
      <header className="sx-top">
        <Link to="/" className="ra-brand" style={{ textDecoration: 'none' }}>
          <span className="ra-brand-logo">
            <img src="/assets/rocas-logo.png" alt="Atol AI" />
          </span>
          <span className="ra-brand-text">
            <span className="ra-brand-name">
              Atol <em>Studio</em>
            </span>
            <span className="ra-brand-tag sx-brand-tag-mobile">Sorteios e conteúdo</span>
          </span>
        </Link>

        <div className="sx-top-right">
          {conta && !emMarketing && (
            <span
              className={`sx-tag sx-tag--${statusToken === 'ok' ? 'ok' : statusToken === 'warn' ? 'warn' : 'out'}`}
            >
              @{conta.username}{' '}
              {statusToken === 'ok' ? 'conectada' : statusToken === 'warn' ? 'renovando' : 'reconectar'}
            </span>
          )}
          <button className="sx-btn sx-btn--primary" onClick={() => navigate(emMarketing ? '/marketing/novo' : '/sorteios/novo')}>
            <Icone nome="mais" tamanho={15} traco={2} />
            {emMarketing ? 'Novo briefing' : 'Novo sorteio'}
          </button>
        </div>
      </header>

      <div className="sx-body">
        <nav className="sx-rail" aria-label="Navegação principal">
          <span className="sx-rail-label">Sorteios</span>
          {SORTEIOS.map(renderItem)}
          <span className="sx-rail-label">Marketing</span>
          {MARKETING.map(renderItem)}
          {!emMarketing && (
            <div className="sx-rail-grupo--secundario">
              <span className="sx-rail-label">Geral</span>
              {GERAL.map(renderItem)}
            </div>
          )}
        </nav>

        <main className="sx-main" ref={main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
