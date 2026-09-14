import { Link } from 'react-router-dom';
import { Icone } from '../../components/Icone';
import { supabase } from '../../lib/supabase';
import { urlAutorizacaoInstagram } from './api';
import { useContaConectada } from './useContaConectada';

const AUTOMACOES = [
  'Renovação do token — diária, 03:10 UTC',
  'Expurgo LGPD — 90 dias após a execução',
  'Watchdog de importação — a cada 5 min',
];

/** Estado da vinculação e transparência das automações (CAP-01, CAP-02) */
export function ConectarConta() {
  const { conta, diasParaExpirar, carregando } = useContaConectada();

  if (!supabase)
    return (
      <div className="sx-wrap--narrow">
        <div className="sx-note sx-note--warn">
          <Icone nome="info" tamanho={15} traco={2} />
          <span>
            Preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> em{' '}
            <code>app/.env</code> e reinicie o servidor.
          </span>
        </div>
      </div>
    );

  if (carregando) return <p className="sx-hint">Carregando…</p>;

  const expirado = diasParaExpirar !== null && diasParaExpirar <= 0;
  const renovando = diasParaExpirar !== null && diasParaExpirar > 0 && diasParaExpirar < 7;

  return (
    <div className="sx-wrap--narrow">
      <header className="sx-head">
        <p className="ra-eyebrow">Conta</p>
        <h1 className="sx-h1">
          Instagram <em>vinculado</em>
        </h1>
        <p className="sx-lede">
          A vinculação acontece uma vez. Depois disso o token renova sozinho — você só escolhe
          o post.
        </p>
      </header>

      {conta ? (
        <div className="sx-acct">
          <div className="sx-acct-av">
            {conta.username.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>@{conta.username}</div>
            <p className="sx-hint">
              Conta Business ·{' '}
              {expirado
                ? 'token expirado'
                : `token válido por ${diasParaExpirar} dia${diasParaExpirar === 1 ? '' : 's'}`}{' '}
              ({new Date(conta.token_expira_em).toLocaleDateString('pt-BR')})
            </p>
          </div>
          <span
            className={`sx-tag ${expirado ? 'sx-tag--out' : renovando ? 'sx-tag--warn' : 'sx-tag--ok'}`}
          >
            {expirado ? 'reconectar' : renovando ? 'renovando' : 'conectada'}
          </span>
        </div>
      ) : (
        <div className="sx-card sx-card--pad" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20 }}>
            Conectar Instagram
          </h2>
          <p className="sx-hint" style={{ margin: '6px auto 18px', maxWidth: '46ch' }}>
            Conexão única via OAuth oficial do Meta. Depois disso, o uso diário é só escolher
            o post.
          </p>
          <a href={urlAutorizacaoInstagram()} className="sx-btn sx-btn--primary sx-btn--lg">
            Conectar conta
          </a>
        </div>
      )}

      {expirado && (
        <div className="sx-note sx-note--warn" style={{ marginTop: 14 }}>
          <Icone nome="info" tamanho={15} traco={2} />
          <span>
            O token expirou — a importação fica bloqueada até reconectar.{' '}
            <a href={urlAutorizacaoInstagram()}>Reconectar agora</a>
          </span>
        </div>
      )}

      <div className="sx-card" style={{ marginTop: 16 }}>
        <p className="sx-proof-label">Automações</p>
        <div className="sx-steps" style={{ marginTop: 0 }}>
          {AUTOMACOES.map((a) => (
            <div key={a} className="sx-substep is-done">
              <span className="sx-dot">
                <Icone nome="check" tamanho={11} traco={3} />
              </span>
              {a}
            </div>
          ))}
        </div>
      </div>

      <div className="sx-note" style={{ marginTop: 16 }}>
        <Icone nome="cadeado" tamanho={15} traco={2} />
        <span>
          Nenhum token do Instagram chega ao navegador. Toda chamada à API oficial acontece no
          servidor.
        </span>
      </div>

      <div className="sx-actions">
        {conta && (
          <a href={urlAutorizacaoInstagram()} className="sx-btn">
            Revincular conta
          </a>
        )}
        <a
          className="sx-btn sx-btn--ghost"
          href="https://privacidade-black.vercel.app/"
          target="_blank"
          rel="noreferrer"
        >
          Política de privacidade
          <Icone nome="externo" tamanho={14} traco={2} />
        </a>
        <Link to="/" className="sx-btn sx-btn--ghost">
          Início
        </Link>
      </div>
    </div>
  );
}
