import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export function MarketingProtegido() {
  const location = useLocation();
  const [estado, setEstado] = useState<'CARREGANDO' | 'AUTENTICADO' | 'SEM_SESSAO'>(
    () => supabase ? 'CARREGANDO' : 'SEM_SESSAO',
  );

  useEffect(() => {
    let ativo = true;
    if (!supabase) {
      return () => { ativo = false; };
    }

    supabase.auth.getUser().then(({ data }) => {
      if (ativo) setEstado(data.user ? 'AUTENTICADO' : 'SEM_SESSAO');
    });
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (ativo) setEstado(sessao?.user ? 'AUTENTICADO' : 'SEM_SESSAO');
    });
    return () => {
      ativo = false;
      assinatura.subscription.unsubscribe();
    };
  }, []);

  if (estado === 'CARREGANDO') {
    return <div className="sx-wrap--narrow"><div className="sx-empty sx-card" role="status">Validando acesso…</div></div>;
  }
  if (estado === 'SEM_SESSAO') {
    return <Navigate to="/login" replace state={{ retornarPara: location.pathname }} />;
  }
  return <Outlet />;
}
