// Wrapper mínimo da Graph API do Instagram (compartilhado entre functions)

export const GRAPH = 'https://graph.instagram.com';

export interface TokenLongo {
  access_token: string;
  expires_in: number; // segundos
}

export async function trocarCodePorTokenCurto(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; user_id: string }> {
  const form = new URLSearchParams({
    client_id: Deno.env.get('IG_APP_ID')!,
    client_secret: Deno.env.get('IG_APP_SECRET')!,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code: code.replace(/#_$/, ''),
  });
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: form,
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(`Troca code→short falhou: ${JSON.stringify(body)}`);
  }
  return { access_token: body.access_token, user_id: String(body.user_id) };
}

export async function upgradeParaLongLived(tokenCurto: string): Promise<TokenLongo> {
  const res = await fetch(
    `${GRAPH}/access_token?grant_type=ig_exchange_token` +
      `&client_secret=${Deno.env.get('IG_APP_SECRET')}&access_token=${tokenCurto}`
  );
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(`Upgrade long-lived falhou: ${JSON.stringify(body)}`);
  }
  return body as TokenLongo;
}

export async function renovarTokenLongo(tokenAtual: string): Promise<TokenLongo> {
  const res = await fetch(
    `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${tokenAtual}`
  );
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(`Refresh falhou: ${JSON.stringify(body)}`);
  }
  return body as TokenLongo;
}

export async function buscarPerfil(token: string): Promise<{ id: string; username: string }> {
  const res = await fetch(`${GRAPH}/me?fields=user_id,username&access_token=${token}`);
  const body = await res.json();
  if (!res.ok) throw new Error(`GET /me falhou: ${JSON.stringify(body)}`);
  return { id: String(body.user_id ?? body.id), username: body.username };
}

export function respostaJson(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

export function respostaCors(): Response {
  return new Response('ok', {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}
