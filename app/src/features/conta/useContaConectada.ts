import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { buscarContaConectada, type ContaConectada } from './api';

/** Conta vinculada + dias restantes do token (usado na topbar e na tela Conta) */
export function useContaConectada() {
  const [conta, setConta] = useState<ContaConectada | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [instanteInicial] = useState(Date.now);

  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!supabase) {
        if (ativo) setCarregando(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (ativo) setCarregando(false);
        return;
      }
      try {
        const c = await buscarContaConectada();
        if (ativo) setConta(c);
      } catch {
        /* topbar não deve quebrar por falha de leitura */
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const diasParaExpirar = conta
    ? Math.floor((new Date(conta.token_expira_em).getTime() - instanteInicial) / 86_400_000)
    : null;

  return { conta, diasParaExpirar, carregando };
}
