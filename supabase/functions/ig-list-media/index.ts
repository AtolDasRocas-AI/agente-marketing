// Lista as mídias da conta conectada para a galeria de escolha do post.
// O token nunca sai da function (AC-17).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GRAPH, respostaJson, respostaCors } from '../_shared/ig.ts';

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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
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

    const { data: token } = await admin.rpc('ler_token_instagram', { p_account_id: conta.id });
    if (!token) return respostaJson({ error: 'Token indisponível.' }, 500);

    /* thumbnail_url é o que serve de capa em VIDEO (media_url é o .mp4).
       CAROUSEL_ALBUM não traz media_url no álbum — vem nos children. */
    const campos =
      'id,caption,media_type,permalink,timestamp,comments_count,media_url,thumbnail_url,' +
      'children{media_url,thumbnail_url,media_type}';
    let url: string | null = `${GRAPH}/me/media?fields=${campos}&limit=50&access_token=${token}`;
    const midias: unknown[] = [];
    let paginas = 0;

    while (url && paginas < 4) { // até 200 posts — suficiente para a galeria
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) return respostaJson({ error: `Graph API: ${JSON.stringify(body.error)}` }, 502);
      midias.push(...(body.data ?? []));
      url = body.paging?.next ?? null;
      paginas++;
    }

    return respostaJson({ account_id: conta.id, username: conta.username, midias });
  } catch (err) {
    console.error('ig-list-media:', err);
    const detalhe =
      err instanceof Error ? err.message
      : typeof err === 'object' && err !== null ? JSON.stringify(err)
      : String(err);
    return respostaJson({ error: detalhe }, 500);
  }
});
