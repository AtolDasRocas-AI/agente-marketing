-- ============================================================
-- Sorteio ATOL — RLS e superfícies de acesso (Onda 1)
-- Regra: todo acesso do client passa por RLS amarrada em
-- ig_account.user_id = auth.uid(). Tokens nunca são legíveis
-- pelo client (schema privado, sem policy — AC-17).
-- ============================================================

-- ============ ig_account ============
alter table ig_account enable row level security;

create policy own_account_select on ig_account
  for select using (user_id = auth.uid());
-- INSERT/UPDATE/DELETE só via service_role (Edge Functions) — sem policy

-- View pública usada pelo app (não expõe nada além do necessário)
create view ig_account_publica
  with (security_invoker = on) as
  select id, username, ig_user_id, token_expira_em, criado_em
  from ig_account;

-- ============ privado.ig_token ============
alter table privado.ig_token enable row level security;
-- ZERO policies: apenas service_role acessa (bypassa RLS).
revoke all on schema privado from anon, authenticated;
revoke all on privado.ig_token from anon, authenticated;

-- ============ demais tabelas: dono via join até ig_account ============
alter table sorteio enable row level security;
create policy own_sorteio on sorteio
  for all using (
    account_id in (select id from ig_account where user_id = auth.uid())
  );

alter table import_job enable row level security;
create policy own_import_job on import_job
  for select using (
    sorteio_id in (
      select s.id from sorteio s
      join ig_account a on a.id = s.account_id
      where a.user_id = auth.uid()
    )
  );

alter table comentario enable row level security;
create policy own_comentario on comentario
  for select using (
    sorteio_id in (
      select s.id from sorteio s
      join ig_account a on a.id = s.account_id
      where a.user_id = auth.uid()
    )
  );

alter table qualificacao enable row level security;
create policy own_qualificacao on qualificacao
  for select using (
    sorteio_id in (
      select s.id from sorteio s
      join ig_account a on a.id = s.account_id
      where a.user_id = auth.uid()
    )
  );

alter table chance enable row level security;
create policy own_chance on chance
  for select using (
    sorteio_id in (
      select s.id from sorteio s
      join ig_account a on a.id = s.account_id
      where a.user_id = auth.uid()
    )
  );

alter table resultado enable row level security;
create policy own_resultado on resultado
  for select using (
    sorteio_id in (
      select s.id from sorteio s
      join ig_account a on a.id = s.account_id
      where a.user_id = auth.uid()
    )
  );
