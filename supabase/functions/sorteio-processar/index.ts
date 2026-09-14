// Roda o motor de regras sobre o snapshot e materializa as chances
// (CAP-07). O motor é o MESMO código do app/verificador — copiado aqui
// porque Edge Functions não compartilham o bundle do front.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { respostaJson, respostaCors } from '../_shared/ig.ts';
import { classificar, montarChances } from '../_shared/regras.ts';

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

    const { sorteio_id } = await req.json();
    if (!sorteio_id) return respostaJson({ error: 'sorteio_id obrigatório' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: sorteio } = await admin
      .from('sorteio')
      .select('*, ig_account!inner(user_id, username)')
      .eq('id', sorteio_id)
      .single();
    if (!sorteio) return respostaJson({ error: 'sorteio não encontrado' }, 404);

    const conta = sorteio.ig_account as { user_id: string; username: string };
    if (conta.user_id !== userData.user.id) return respostaJson({ error: 'sem permissão' }, 403);

    // snapshot completo (paginado para não estourar memória em posts grandes)
    const comentarios: Array<{
      id: string; ig_comment_id: string; autor_username: string | null;
      texto: string; publicado_em: string; is_reply: boolean;
    }> = [];
    const LOTE = 1000;
    for (let inicio = 0; ; inicio += LOTE) {
      const { data, error } = await admin
        .from('comentario')
        .select('id, ig_comment_id, autor_username, texto, publicado_em, is_reply')
        .eq('sorteio_id', sorteio_id)
        .order('ig_comment_id', { ascending: true })
        .range(inicio, inicio + LOTE - 1);
      if (error) throw error;
      if (!data?.length) break;
      comentarios.push(...data);
      if (data.length < LOTE) break;
    }

    const classificacoes = classificar(comentarios, {
      organizador: conta.username,
      modo: sorteio.modo,
      teto_chances: sorteio.teto_chances,
      mencoes_minimas: sorteio.mencoes_minimas,
      teto_mencoes: sorteio.teto_mencoes,
      palavra_chave: sorteio.palavra_chave,
      marcar_suspeitos: sorteio.marcar_suspeitos ?? false,
      incluir_respostas: sorteio.incluir_respostas ?? false,
      janela_inicio: sorteio.janela_inicio,
      janela_fim: sorteio.janela_fim,
    });

    // qualificação em lotes (upsert por comentário)
    for (let i = 0; i < classificacoes.length; i += 500) {
      const lote = classificacoes.slice(i, i + 500).map((c) => ({
        sorteio_id,
        comentario_id: c.comentario_id,
        status: c.status,
        motivo: c.motivo ?? c.flags[0] ?? null,
        mencoes_validas: c.mencoes_validas,
      }));
      const { error } = await admin
        .from('qualificacao')
        .upsert(lote, { onConflict: 'comentario_id' });
      if (error) throw error;
    }

    // chances: recriadas do zero a cada processamento
    const chances = montarChances(classificacoes);
    await admin.from('chance').delete().eq('sorteio_id', sorteio_id);
    for (let i = 0; i < chances.length; i += 500) {
      const lote = chances.slice(i, i + 500).map((c) => ({
        sorteio_id,
        ordem: c.ordem,
        autor_username: c.autor_username,
        comentario_id: c.comentario_id,
      }));
      const { error } = await admin.from('chance').insert(lote);
      if (error) throw error;
    }

    await admin.from('sorteio').update({ status: 'PRONTO' }).eq('id', sorteio_id);

    const resumo = { HABILITADO: 0, SUSPEITO: 0, DESQUALIFICADO: 0 } as Record<string, number>;
    for (const c of classificacoes) resumo[c.status]++;

    return respostaJson({
      total_comentarios: comentarios.length,
      resumo,
      total_chances: chances.length,
      autores_distintos: new Set(chances.map((c) => c.autor_username)).size,
    });
  } catch (err) {
    console.error('sorteio-processar:', err);
    const detalhe =
      err instanceof Error ? err.message
      : typeof err === 'object' && err !== null ? JSON.stringify(err)
      : String(err);
    return respostaJson({ error: detalhe }, 500);
  }
});
