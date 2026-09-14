import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icone } from '../../components/Icone';
import { exigirSupabase } from '../../lib/supabase';

/** Login do organizador (sistema monousuário — P-03) */
export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const { error } = await exigirSupabase().auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) throw error;
      navigate('/');
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
        <h1 className="sx-h1">
          Entrar no <em>Sorteios</em>
        </h1>
        <p className="sx-lede">Acesso restrito ao organizador.</p>
      </header>

      <form onSubmit={entrar} className="sx-card sx-card--pad" style={{ display: 'grid', gap: 18 }}>
        <div className="sx-field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            className="sx-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="sx-field">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            className="sx-input"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {erro && (
          <div className="sx-note sx-note--warn" role="alert">
            <Icone nome="info" tamanho={15} traco={2} />
            <span>{erro}</span>
          </div>
        )}

        <button className="sx-btn sx-btn--primary sx-btn--lg" disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
