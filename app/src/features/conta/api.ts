import { exigirSupabase } from '../../lib/supabase';

export interface ContaConectada {
  id: string;
  username: string;
  ig_user_id: string;
  token_expira_em: string;
  criado_em: string;
}

/** Conta conectada do organizador (view pública SEM a coluna de token — AC-17) */
export async function buscarContaConectada(): Promise<ContaConectada | null> {
  const { data, error } = await exigirSupabase()
    .from('ig_account_publica')
    .select('id, username, ig_user_id, token_expira_em, criado_em')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Monta a URL de autorização do Instagram (App ID é público; o secret vive só na Edge Function) */
export function urlAutorizacaoInstagram(): string {
  const appId = import.meta.env.VITE_IG_APP_ID as string;
  const redirect = import.meta.env.VITE_IG_REDIRECT_URI as string;
  const scopes = 'instagram_business_basic,instagram_business_manage_comments';
  return (
    `https://www.instagram.com/oauth/authorize` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&response_type=code&scope=${scopes}`
  );
}

/** Envia o code para a Edge Function trocar por token (server-side) */
export async function concluirConexao(code: string): Promise<ContaConectada> {
  const sb = exigirSupabase();
  const { data, error } = await sb.functions.invoke('ig-oauth-callback', {
    body: { code, redirect_uri: import.meta.env.VITE_IG_REDIRECT_URI },
  });
  if (error) throw error;
  return data as ContaConectada;
}
