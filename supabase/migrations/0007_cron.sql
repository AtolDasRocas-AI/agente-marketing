-- ============================================================
-- Jobs automáticos (AC-02 e AC-16)
--   03:10 UTC · ig-token-refresh → renova tokens com <7 dias
--   03:40 UTC · lgpd-expurgo     → apaga dados pessoais de 90+ dias
--   */5 min   · watchdog         → importação travada volta a PENDENTE
--
-- As chamadas HTTP usam pg_net e leem a service key do Vault — ela
-- nunca aparece em texto nesta migração. Os segredos são criados pelo
-- script scripts/configurar-cron.mjs antes desta migração rodar.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function chamar_edge_function(nome text, corpo jsonb default '{}'::jsonb)
returns bigint
language plpgsql security definer set search_path = public, vault, extensions as $$
declare
  v_projeto_url text;
  v_chave       text;
begin
  select decrypted_secret into v_projeto_url from vault.decrypted_secrets where name = 'projeto_url';
  select decrypted_secret into v_chave       from vault.decrypted_secrets where name = 'service_role_key';

  if v_projeto_url is null or v_chave is null then
    raise exception 'Segredos projeto_url/service_role_key ausentes no Vault';
  end if;

  return net.http_post(
    url     := v_projeto_url || '/functions/v1/' || nome,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_chave
    ),
    body    := corpo
  );
end $$;

revoke execute on function chamar_edge_function(text, jsonb) from anon, authenticated, public;

-- ── watchdog de importação (job travado em RODANDO) ──
create or replace function watchdog_importacao() returns void
language sql security definer set search_path = public as $$
  update import_job
     set status = 'PENDENTE', atualizado_em = now()
   where status = 'RODANDO'
     and atualizado_em < now() - interval '10 minutes';
$$;

revoke execute on function watchdog_importacao() from anon, authenticated, public;

-- ── agendamentos (idempotentes) ──
do $$
begin
  perform cron.unschedule('renovar-token-instagram')
    where exists (select 1 from cron.job where jobname = 'renovar-token-instagram');
  perform cron.unschedule('expurgo-lgpd')
    where exists (select 1 from cron.job where jobname = 'expurgo-lgpd');
  perform cron.unschedule('watchdog-importacao')
    where exists (select 1 from cron.job where jobname = 'watchdog-importacao');
end $$;

select cron.schedule('renovar-token-instagram', '10 3 * * *',
  $$select chamar_edge_function('ig-token-refresh')$$);

select cron.schedule('expurgo-lgpd', '40 3 * * *',
  $$select chamar_edge_function('lgpd-expurgo')$$);

select cron.schedule('watchdog-importacao', '*/5 * * * *',
  $$select watchdog_importacao()$$);
