import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icone } from '../../components/Icone';
import { exigirSupabase } from '../../lib/supabase';
import { EMAIL_ATOL } from './AcessoAtol';

/** Login do organizador (sistema monousuário — P-03) */
export function Login() {
  const location = useLocation();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrarComGoogle() {
    setErro(null);
    setCarregando(true);
    try {
      const retornarPara = (location.state as { retornarPara?: string } | null)?.retornarPara;
      const destino = retornarPara?.startsWith('/') ? retornarPara : '/';
      const { error } = await exigirSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + destino, scopes: 'https://www.googleapis.com/auth/userinfo.email' },
      });
      if (error) throw error;
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="sx-wrap--narrow">
      <header className="sx-head">
        <p className="ra-eyebrow">Acesso</p>
        <h1 className="sx-h1">Entrar na <em>ATOL</em></h1>
        <p className="sx-lede">Acesso exclusivo pela conta Google institucional.</p>
      </header>

      <section className="sx-card sx-card--pad" style={{ display: 'grid', gap: 18 }}>
        <p className="sx-hint">Permitido somente: <b>{EMAIL_ATOL}</b></p>
        {erro && (
          <div className="sx-note sx-note--warn" role="alert">
            <Icone nome="info" tamanho={15} traco={2} />
            <span>{erro}</span>
          </div>
        )}

        <button className="sx-btn sx-btn--primary sx-btn--lg" type="button" onClick={() => void entrarComGoogle()} disabled={carregando}>
          {carregando ? 'Redirecionando…' : 'Entrar com Google'}
        </button>
      </section>
    </div>
  );
}
