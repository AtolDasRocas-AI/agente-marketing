// Renova tokens com menos de 7 dias restantes (AC-02).
// Trigger: pg_cron diário (ou chamada manual com service key).
// Regra do Meta: só renova token com >24h de vida e não expirado.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { renovarTokenLongo, respostaJson } from '../_shared/ig.ts';

Deno.serve(async (req) => {
  // Só o pg_cron dispara, com um segredo dedicado (x-cron-secret).
  // Não usamos SUPABASE_SERVICE_ROLE_KEY para autenticar: o projeto pode
  // ter chaves em dois formatos (JWT legado e sb_secret_) e o runtime nem
  // sempre injeta o mesmo que o Vault guardou — foi o que causou o 401.
  const segredo = Deno.env.get('CRON_SECRET');
  if (!segredo || req.headers.get('x-cron-secret') !== segredo) {
    return respostaJson({ error: 'não autorizado' }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: pendentes, error } = await supabaseAdmin.rpc('listar_tokens_a_renovar', {
    p_dias: 7,
  });
  if (error) return respostaJson({ error: error.message }, 500);

  const resultados: Array<{ account_id: string; ok: boolean; erro?: string }> = [];
  for (const t of pendentes ?? []) {
    try {
      const novo = await renovarTokenLongo(t.access_token);
      const expiraEm = new Date(Date.now() + novo.expires_in * 1000).toISOString();
      const { error: updErr } = await supabaseAdmin.rpc('atualizar_token_renovado', {
        p_account_id: t.account_id,
        p_access_token: novo.access_token,
        p_expira_em: expiraEm,
      });
      if (updErr) throw updErr;
      resultados.push({ account_id: t.account_id, ok: true });
    } catch (err) {
      // Falha de refresh é o risco nº 2 do plano — loga alto para alerta
      console.error(`REFRESH FALHOU account=${t.account_id}:`, err);
      resultados.push({
        account_id: t.account_id,
        ok: false,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return respostaJson({ verificados: pendentes?.length ?? 0, resultados });
});
