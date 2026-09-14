// Conta com precisão os comentários de um post: 1º nível e respostas.
// Existe porque o `comments_count` da API conta apenas o 1º nível,
// enquanto o app do Instagram mostra o total (1º nível + respostas) —
// a diferença confunde quem compara os dois números.
// Só para o post selecionado: fazer isso na galeria inteira seria lento.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GRAPH, respostaJson, respostaCors } from '../_shared/ig.ts';

const MAX_PAGINAS = 60; // ~3.000 comentários de 1º nível

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

    const { ig_media_id } = await req.json();
    if (!ig_media_id) return respostaJson({ error: 'ig_media_id obrigatório' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: contas } = await admin
      .from('ig_account')
      .select('id, token_expira_em')
      .eq('user_id', userData.user.id)
      .limit(1);
    const conta = contas?.[0];
    if (!conta) return respostaJson({ error: 'Nenhuma conta conectada.' }, 400);
    if (new Date(conta.token_expira_em) <= new Date()) {
      return respostaJson({ error: 'TOKEN_EXPIRADO', reconectar: true }, 401);
    }

    const { data: token } = await admin.rpc('ler_token_instagram', { p_account_id: conta.id });
    if (!token) return respostaJson({ error: 'Token indisponível.' }, 500);

    let nivel1 = 0;
    let respostas = 0;
    let paginas = 0;
    let truncado = false;
    let url: string | null =
      `${GRAPH}/${ig_media_id}/comments?fields=id,replies.limit(50){id}&limit=50&access_token=${token}`;

    while (url && paginas < MAX_PAGINAS) {
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) return respostaJson({ error: `Graph API: ${JSON.stringify(body.error)}` }, 502);
      for (const c of body.data ?? []) {
        nivel1++;
        respostas += c.replies?.data?.length ?? 0;
      }
      url = body.paging?.next ?? null;
      paginas++;
    }
    if (url) truncado = true;

    return respostaJson({ nivel1, respostas, total: nivel1 + respostas, truncado });
  } catch (err) {
    console.error('ig-contagem-post:', err);
    const detalhe =
      err instanceof Error ? err.message
      : typeof err === 'object' && err !== null ? JSON.stringify(err)
      : String(err);
    return respostaJson({ error: detalhe }, 500);
  }
});
