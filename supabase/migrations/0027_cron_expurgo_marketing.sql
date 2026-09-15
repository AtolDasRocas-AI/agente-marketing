-- ATOL Studio — agenda o expurgo LGPD dos comentários do Instagram de Marketing (Sprint C).
-- Reaproveita chamar_edge_function() e os segredos do Vault já configurados em 0007/0008
-- (projeto_url, cron_secret) — nenhum segredo novo é necessário.

do $$
begin
  perform cron.unschedule('expurgo-lgpd-marketing')
    where exists (select 1 from cron.job where jobname = 'expurgo-lgpd-marketing');
end $$;

select cron.schedule('expurgo-lgpd-marketing', '50 3 * * *',
  $$select chamar_edge_function('lgpd-expurgo-marketing')$$);
