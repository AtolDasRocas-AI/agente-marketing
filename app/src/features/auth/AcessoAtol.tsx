import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export const EMAIL_ATOL = 'atoldasrocas.ai@gmail.com';

function permitido(email: string | undefined) { return email?.toLowerCase() === EMAIL_ATOL; }

export function AcessoAtol() {
  const location = useLocation();
  const [estado, setEstado] = useState<'CARREGANDO' | 'OK' | 'NEGADO'>(() => supabase ? 'CARREGANDO' : 'NEGADO');
  useEffect(() => {
    let ativo = true;
    if (!supabase) return () => { ativo = false; };
    const client = supabase;
    client.auth.getUser().then(async ({ data }) => {
      const ok = permitido(data.user?.email);
      if (!ok && data.user) await client.auth.signOut();
      if (ativo) setEstado(ok ? 'OK' : 'NEGADO');
    });
    return () => { ativo = false; };
  }, []);
  if (estado === 'CARREGANDO') return <div className="sx-wrap--narrow"><div className="sx-empty sx-card">Validando acesso…</div></div>;
  if (estado === 'NEGADO') return <Navigate to="/login" replace state={{ retornarPara: location.pathname }} />;
  return <Outlet />;
}
