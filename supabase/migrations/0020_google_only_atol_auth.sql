-- Acesso da aplicação: somente Google e a conta institucional ATOL.
-- A ativação da função como "Before User Created Hook" é feita no painel Auth.

begin;

create function public.hook_permitir_somente_google_atol(event jsonb)
returns jsonb
language plpgsql
set search_path = '' as $$
declare
  v_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
  v_provider text := lower(coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', ''));
begin
  if v_email <> 'atoldasrocas.ai@gmail.com' or v_provider <> 'google' then
    return pg_catalog.jsonb_build_object('error', pg_catalog.jsonb_build_object(
      'http_code', 403,
      'message', 'O acesso é restrito à conta Google institucional da ATOL.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

revoke all on function public.hook_permitir_somente_google_atol(jsonb) from public, anon, authenticated;
grant execute on function public.hook_permitir_somente_google_atol(jsonb) to supabase_auth_admin;

commit;
