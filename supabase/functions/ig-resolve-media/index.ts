// Resolve um permalink colado → media_id da conta conectada (CAP-03, P-08).
// Estratégia validada na Onda 0: pagina /me/media e casa o shortcode.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GRAPH, respostaJson, respostaCors } from '../_shared/ig.ts';

function shortcodeDe(url: string | null): string | null {
  if (!url) return null;
  const m = String(url).match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

interface Midia {
  id: string;
  caption?: string;
  media_type: string;
  permalink: string;
  timestamp: string;
  comments_count: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();

  try {
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: userData } = await supabaseAuth.auth.getUser();
    if (!userData?.user) return respostaJson({ error: 'não autenticado' }, 401);

    const { permalink } = await req.json();
    const alvo = shortcodeDe(permalink);
    if (!alvo) return respostaJson({ error: 'Permalink inválido.' }, 400); // E-20

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // conta do organizador + token (nunca sai daqui)
    const { data: contas } = await admin
      .from('ig_account')
      .select('id, username, token_expira_em')
      .eq('user_id', userData.user.id)
      .limit(1);
    const conta = contas?.[0];
    if (!conta) return respostaJson({ error: 'Nenhuma conta Instagram conectada.' }, 400);
    if (new Date(conta.token_expira_em) <= new Date()) {
      return respostaJson({ error: 'TOKEN_EXPIRADO', reconectar: true }, 401); // E-17
    }

    const { data: token, error: tokenErr } = await admin.rpc('ler_token_instagram', {
      p_account_id: conta.id,
    });
    if (tokenErr || !token) return respostaJson({ error: 'Token indisponível.' }, 500);

    // pagina /me/media procurando o shortcode
    const campos = 'id,caption,media_type,permalink,timestamp,comments_count';
    let url: string | null =
      `${GRAPH}/me/media?fields=${campos}&limit=50&access_token=${token}`;
    let paginas = 0;
    while (url && paginas < 20) {
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) return respostaJson({ error: `Graph API: ${JSON.stringify(body.error)}` }, 502);

      const achada = (body.data as Midia[]).find((m) => shortcodeDe(m.permalink) === alvo);
      if (achada) {
        if (achada.media_type === 'VIDEO' && /\/reel/.test(achada.permalink)) {
          return respostaJson({ error: 'Reels não são suportados nesta versão.' }, 400); // E-21
        }
        return respostaJson({
          account_id: conta.id,
          ig_media_id: achada.id,
          permalink: achada.permalink,
          caption: achada.caption ?? '',
          media_type: achada.media_type,
          timestamp: achada.timestamp,
          comments_count: achada.comments_count,
        });
      }
      url = body.paging?.next ?? null;
      paginas++;
    }

    // E-19: post não é da conta conectada
    return respostaJson(
      { error: `Este post não pertence à conta conectada (@${conta.username}).` },
      404
    );
  } catch (err) {
    console.error('ig-resolve-media:', err);
    const detalhe =
      err instanceof Error ? err.message
      : typeof err === 'object' && err !== null ? JSON.stringify(err)
      : String(err);
    return respostaJson({ error: detalhe }, 500);
  }
});
