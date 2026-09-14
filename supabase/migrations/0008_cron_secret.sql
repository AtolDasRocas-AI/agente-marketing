-- ============================================================
-- Correção do 401 nos jobs.
--
-- A versão anterior autenticava comparando o header Authorization
-- com SUPABASE_SERVICE_ROLE_KEY. Falhou porque o projeto tem chaves
-- em dois formatos (JWT legado e sb_secret_) e o runtime das Edge
-- Functions não injeta necessariamente a mesma que o Vault guardou.
--
-- Agora usamos um segredo dedicado ao cron, enviado em x-cron-secret,
-- e a service key deixa de trafegar em header.
-- Requer o segredo 'cron_secret' no Vault (criado por configurar-cron.mjs).
-- ============================================================

create or replace function chamar_edge_function(nome text, corpo jsonb default '{}'::jsonb)
returns bigint
language plpgsql security definer set search_path = public, vault, extensions as $$
declare
  v_projeto_url text;
  v_segredo     text;
begin
  select decrypted_secret into v_projeto_url from vault.decrypted_secrets where name = 'projeto_url';
  select decrypted_secret into v_segredo     from vault.decrypted_secrets where name = 'cron_secret';

  if v_projeto_url is null or v_segredo is null then
    raise exception 'Segredos projeto_url/cron_secret ausentes no Vault';
  end if;

  return net.http_post(
    url     := v_projeto_url || '/functions/v1/' || nome,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_segredo
    ),
    body    := corpo
  );
end $$;

revoke execute on function chamar_edge_function(text, jsonb) from anon, authenticated, public;
