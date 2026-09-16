-- ATOL Studio — Onda 5 do spec-kit "Análise Avançada de Instagram": agenda a análise de
-- IA por post amadurecido (7 dias). Sem isso, "automática quando o post amadurece"
-- (CAP-13) nunca dispararia sozinha — só ficaria disponível pelo botão manual.
-- Reaproveita chamar_edge_function() e os segredos do Vault já configurados em 0007/0008.
-- Roda depois do cron de importação de métricas (03:20 UTC), para já ter dado fresco.

do $$
begin
  perform cron.unschedule('analisar-posts-marketing')
    where exists (select 1 from cron.job where jobname = 'analisar-posts-marketing');
end $$;

select cron.schedule('analisar-posts-marketing', '35 3 * * *',
  $$select chamar_edge_function('marketing-analisar-post-instagram')$$);
