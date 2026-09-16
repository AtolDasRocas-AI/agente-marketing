-- ATOL Studio — Onda 2 do spec-kit "Análise Avançada de Instagram": coleta diária
-- automática de métricas do Instagram (posts + conta), para o gráfico de tendência ter
-- dado contínuo em vez de depender só do clique manual em "Importar métricas agora".
-- Reaproveita chamar_edge_function() e os segredos do Vault já configurados em 0007/0008
-- (projeto_url, service_role_key) — nenhum segredo novo é necessário.
--
-- marketing-importar-metricas-instagram exige workspace_id no corpo da chamada; este
-- wrapper dispara uma chamada por workspace com conexão Instagram ativa (hoje é só um,
-- mas o laço não assume isso).

create or replace function marketing_cron_importar_metricas_instagram() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_conexao record;
begin
  for v_conexao in select workspace_id from marketing_instagram_connection loop
    perform chamar_edge_function(
      'marketing-importar-metricas-instagram',
      jsonb_build_object('workspace_id', v_conexao.workspace_id)
    );
  end loop;
end $$;

revoke execute on function marketing_cron_importar_metricas_instagram() from anon, authenticated, public;

do $$
begin
  perform cron.unschedule('importar-metricas-marketing')
    where exists (select 1 from cron.job where jobname = 'importar-metricas-marketing');
end $$;

select cron.schedule('importar-metricas-marketing', '20 3 * * *',
  $$select marketing_cron_importar_metricas_instagram()$$);
