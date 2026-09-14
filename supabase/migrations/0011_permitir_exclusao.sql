-- ============================================================
-- Permitir apagar um sorteio inteiro.
--
-- O trigger append-only bloqueava UPDATE e DELETE em `resultado`.
-- Bloquear UPDATE é o que garante a imutabilidade (RNF-06): um
-- resultado gravado nunca muda. Mas apagar a rodada inteira é um ato
-- deliberado do organizador — e é exigido pela LGPD (direito à
-- eliminação). Agora o trigger cobre apenas UPDATE.
-- ============================================================

drop trigger if exists resultado_append_only on resultado;

create trigger resultado_sem_update
  before update on resultado
  for each row execute function bloquear_mutacao();

-- Policies de DELETE para o organizador (RLS já garante que é o dono).
-- As tabelas filhas caem por cascade da FK, que não passa por RLS.
drop policy if exists own_sorteio on sorteio;
create policy own_sorteio on sorteio
  for all using (
    account_id in (select id from ig_account where user_id = auth.uid())
  );

create policy own_resultado_delete on resultado
  for delete using (
    sorteio_id in (
      select s.id from sorteio s
      join ig_account a on a.id = s.account_id
      where a.user_id = auth.uid()
    )
  );
