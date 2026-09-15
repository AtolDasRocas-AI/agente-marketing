// Expurgo LGPD dos comentários do Instagram importados para Marketing (Sprint C).
// Remove autor/texto após 90 dias; preserva categoria/data/publicação para agregados.
// Trigger: pg_cron diário, mesmo padrão de lgpd-expurgo (módulo Sorteios).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { respostaJson } from '../_shared/ig.ts';

const DIAS_RETENCAO = 90;
const MARCADOR_EXPURGADO = '[expurgado - LGPD 90 dias]';

Deno.serve(async (req) => {
  const segredo = Deno.env.get('CRON_SECRET');
  if (!segredo || req.headers.get('x-cron-secret') !== segredo) {
    return respostaJson({ error: 'não autorizado' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const corte = new Date(Date.now() - DIAS_RETENCAO * 86_400_000).toISOString();

  const { data: expurgados, error } = await admin
    .from('marketing_instagram_comment_snapshot')
    .update({ autor_username: null, texto: MARCADOR_EXPURGADO })
    .lt('coletado_em', corte)
    .neq('texto', MARCADOR_EXPURGADO)
    .select('id');
  if (error) return respostaJson({ error: error.message }, 500);

  console.log(`LGPD Marketing: expurgados ${expurgados?.length ?? 0} comentários com mais de ${DIAS_RETENCAO} dias.`);

  return respostaJson({
    corte,
    dias_retencao: DIAS_RETENCAO,
    expurgados: expurgados?.length ?? 0,
  });
});
