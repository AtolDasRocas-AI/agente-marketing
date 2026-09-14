-- ============================================================
-- Correção: `revoke execute ... from public` na 0003 também
-- removeu o EXECUTE do service_role (que herdava de PUBLIC).
-- As Edge Functions precisam de grant explícito.
-- anon/authenticated seguem SEM acesso (AC-17 preservado).
-- ============================================================

grant usage on schema privado to service_role;
grant all on privado.ig_token to service_role;

grant execute on function salvar_conta_instagram(uuid, text, text, text, timestamptz) to service_role;
grant execute on function ler_token_instagram(uuid) to service_role;
grant execute on function listar_tokens_a_renovar(int) to service_role;
grant execute on function atualizar_token_renovado(uuid, text, timestamptz) to service_role;
