-- ============================================================
-- Funções de acesso ao token (SECURITY DEFINER)
-- O schema `privado` não é exposto ao PostgREST; as Edge
-- Functions (service_role) acessam o token só por estas RPCs.
-- EXECUTE revogado de anon/authenticated — client nunca chama.
-- ============================================================

create or replace function salvar_conta_instagram(
  p_user_id uuid,
  p_ig_user_id text,
  p_username text,
  p_access_token text,
  p_expira_em timestamptz
) returns table (id uuid, username text, ig_user_id text, token_expira_em timestamptz, criado_em timestamptz)
language plpgsql security definer set search_path = public, privado as $$
declare v_account_id uuid;
begin
  insert into ig_account (user_id, ig_user_id, username, token_expira_em)
  values (p_user_id, p_ig_user_id, p_username, p_expira_em)
  on conflict (user_id, ig_user_id)
  do update set username = excluded.username, token_expira_em = excluded.token_expira_em
  returning ig_account.id into v_account_id;

  insert into privado.ig_token (account_id, access_token)
  values (v_account_id, p_access_token)
  on conflict (account_id)
  do update set access_token = excluded.access_token, atualizado_em = now();

  return query
    select a.id, a.username, a.ig_user_id, a.token_expira_em, a.criado_em
    from ig_account a where a.id = v_account_id;
end $$;

create or replace function ler_token_instagram(p_account_id uuid)
returns text
language sql security definer set search_path = public, privado as $$
  select access_token from privado.ig_token where account_id = p_account_id;
$$;

create or replace function listar_tokens_a_renovar(p_dias int default 7)
returns table (account_id uuid, access_token text, token_expira_em timestamptz)
language sql security definer set search_path = public, privado as $$
  select t.account_id, t.access_token, a.token_expira_em
  from privado.ig_token t
  join ig_account a on a.id = t.account_id
  where a.token_expira_em < now() + make_interval(days => p_dias)
    and a.token_expira_em > now() + interval '24 hours'; -- refresh exige >24h de vida
$$;

create or replace function atualizar_token_renovado(
  p_account_id uuid, p_access_token text, p_expira_em timestamptz
) returns void
language plpgsql security definer set search_path = public, privado as $$
begin
  update privado.ig_token
    set access_token = p_access_token, atualizado_em = now()
    where account_id = p_account_id;
  update ig_account set token_expira_em = p_expira_em where id = p_account_id;
end $$;

-- Client NUNCA executa estas funções (AC-17)
revoke execute on function salvar_conta_instagram(uuid, text, text, text, timestamptz) from anon, authenticated, public;
revoke execute on function ler_token_instagram(uuid) from anon, authenticated, public;
revoke execute on function listar_tokens_a_renovar(int) from anon, authenticated, public;
revoke execute on function atualizar_token_renovado(uuid, text, timestamptz) from anon, authenticated, public;
