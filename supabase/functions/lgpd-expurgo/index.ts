// Expurgo LGPD (RNF-03, AC-16): apaga dados pessoais de sorteios com
// 90+ dias, preservando o comprovante agregado em `resultado`.
// Trigger: pg_cron diário.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { respostaJson } from '../_shared/ig.ts';

const DIAS_RETENCAO = 90;

Deno.serve(async (req) => {
  // disparado só pelo pg_cron, via segredo dedicado
  const segredo = Deno.env.get('CRON_SECRET');
  if (!segredo || req.headers.get('x-cron-secret') !== segredo) {
    return respostaJson({ error: 'não autorizado' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const corte = new Date(Date.now() - DIAS_RETENCAO * 86_400_000).toISOString();

  // sorteios já executados e fora do prazo de retenção
  const { data: vencidos, error } = await admin
    .from('sorteio')
    .select('id, titulo, encerrado_em')
    .lt('encerrado_em', corte)
    .eq('status', 'SORTEADO');
  if (error) return respostaJson({ error: error.message }, 500);

  const expurgados: Array<{ sorteio_id: string; comentarios: number }> = [];

  for (const s of vencidos ?? []) {
    const { count } = await admin
      .from('comentario')
      .select('*', { count: 'exact', head: true })
      .eq('sorteio_id', s.id);
    if (!count) continue; // já expurgado

    // ordem importa: chance e qualificacao referenciam comentario
    await admin.from('chance').delete().eq('sorteio_id', s.id);
    await admin.from('qualificacao').delete().eq('sorteio_id', s.id);
    await admin.from('comentario').delete().eq('sorteio_id', s.id);

    // `resultado` permanece: é o comprovante agregado do sorteio.
    expurgados.push({ sorteio_id: s.id, comentarios: count });
    console.log(`LGPD: expurgados ${count} comentários do sorteio ${s.id} (${s.titulo})`);
  }

  return respostaJson({
    corte,
    dias_retencao: DIAS_RETENCAO,
    sorteios_verificados: vencidos?.length ?? 0,
    expurgados,
  });
});
