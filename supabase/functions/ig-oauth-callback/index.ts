// Troca o code OAuth por token long-lived e persiste a conta.
// Auth: exige JWT de usuário logado (organizador). O token do
// Instagram nunca volta na resposta (AC-17).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  trocarCodePorTokenCurto,
  upgradeParaLongLived,
  buscarPerfil,
  respostaJson,
  respostaCors,
} from '../_shared/ig.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();
  if (req.method !== 'POST') return respostaJson({ error: 'method not allowed' }, 405);

  try {
    // 1. Identifica o organizador pelo JWT do request
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData.user) return respostaJson({ error: 'não autenticado' }, 401);

    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) return respostaJson({ error: 'code e redirect_uri obrigatórios' }, 400);

    // 2. code → short-lived → long-lived (~60 dias)
    const curto = await trocarCodePorTokenCurto(code, redirect_uri);
    const longo = await upgradeParaLongLived(curto.access_token);
    const perfil = await buscarPerfil(longo.access_token);
    const expiraEm = new Date(Date.now() + longo.expires_in * 1000).toISOString();

    // 3. Persiste via RPC security-definer (service_role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: conta, error: rpcErr } = await supabaseAdmin.rpc('salvar_conta_instagram', {
      p_user_id: userData.user.id,
      p_ig_user_id: perfil.id || curto.user_id,
      p_username: perfil.username,
      p_access_token: longo.access_token,
      p_expira_em: expiraEm,
    });
    if (rpcErr) throw rpcErr;

    return respostaJson(Array.isArray(conta) ? conta[0] : conta);
  } catch (err) {
    console.error('ig-oauth-callback:', err);
    const detalhe =
      err instanceof Error ? err.message
      : typeof err === 'object' && err !== null ? JSON.stringify(err)
      : String(err);
    return respostaJson({ error: detalhe }, 500);
  }
});
