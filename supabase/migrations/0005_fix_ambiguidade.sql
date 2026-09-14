-- ============================================================
-- Correção: os parâmetros de saída do RETURNS TABLE (id, username,
-- ig_user_id, ...) viram variáveis PL/pgSQL e colidem com as colunas
-- homônimas de ig_account — o `on conflict (user_id, ig_user_id)`
-- ficava ambíguo (erro 42702).
-- `#variable_conflict use_column` resolve a favor da coluna.
-- ============================================================

create or replace function salvar_conta_instagram(
  p_user_id uuid,
  p_ig_user_id text,
  p_username text,
  p_access_token text,
  p_expira_em timestamptz
) returns table (id uuid, username text, ig_user_id text, token_expira_em timestamptz, criado_em timestamptz)
language plpgsql security definer set search_path = public, privado as $$
#variable_conflict use_column
declare v_account_id uuid;
begin
  insert into ig_account as a (user_id, ig_user_id, username, token_expira_em)
  values (p_user_id, p_ig_user_id, p_username, p_expira_em)
  on conflict (user_id, ig_user_id)
  do update set username = excluded.username, token_expira_em = excluded.token_expira_em
  returning a.id into v_account_id;

  insert into privado.ig_token (account_id, access_token)
  values (v_account_id, p_access_token)
  on conflict (account_id)
  do update set access_token = excluded.access_token, atualizado_em = now();

  return query
    select a.id, a.username, a.ig_user_id, a.token_expira_em, a.criado_em
    from ig_account a where a.id = v_account_id;
end $$;

grant execute on function salvar_conta_instagram(uuid, text, text, text, timestamptz) to service_role;
revoke execute on function salvar_conta_instagram(uuid, text, text, text, timestamptz) from anon, authenticated;
