-- ATOL Studio — restringe o acesso a uma única conta Google institucional.
-- Substitui a lista de e-mails autorizados definida em 0020 (nunca editar 0020).

begin;

create or replace function public.hook_permitir_somente_google_atol(event jsonb)
returns jsonb
language plpgsql
set search_path = '' as $$
declare
  v_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
  v_provider text := lower(coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', ''));
begin
  if v_provider <> 'google' or v_email <> 'atoldasrocas.ai@gmail.com' then
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
