-- ============================================================
-- ATOL Studio — endurecimento incremental após a fundação Marketing
-- Não altera dados de conteúdo e não reescreve migrations aplicadas.
-- ============================================================

begin;
set local lock_timeout = '5s';

-- ---------- integridade e desempenho do legado ----------

do $$
begin
  if exists (
    select 1 from public.resultado group by sorteio_id having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'Existem resultados duplicados por sorteio; a migration foi cancelada sem alterações';
  end if;
end;
$$;

create unique index if not exists resultado_sorteio_id_uk
  on public.resultado (sorteio_id);
create index if not exists import_job_sorteio_id_idx
  on public.import_job (sorteio_id);
create index if not exists qualificacao_sorteio_id_idx
  on public.qualificacao (sorteio_id);
create index if not exists chance_comentario_id_idx
  on public.chance (comentario_id);
create index if not exists marketing_content_item_criado_por_idx
  on public.marketing_content_item (criado_por);
create index if not exists marketing_ai_run_solicitado_por_idx
  on public.marketing_ai_run (solicitado_por);

drop policy if exists own_resultado_delete on public.resultado;
revoke delete on table public.resultado from public, anon, authenticated;

alter function public.bloquear_mutacao() set search_path = '';

-- A tabela pertence ao mecanismo antigo de implantação e fica somente para
-- consulta administrativa. O aplicativo e o runner atual não dependem dela.
do $$
begin
  if pg_catalog.to_regclass('public._migracoes') is not null then
    alter table public._migracoes enable row level security;
    revoke all privileges on table public._migracoes from public, anon, authenticated;
  end if;
end;
$$;

-- ---------- criação de briefing idempotente ----------

alter table public.marketing_content_item
  add column if not exists idempotency_key uuid;

create unique index if not exists marketing_content_item_create_idempotency_uk
  on public.marketing_content_item (workspace_id, criado_por, idempotency_key)
  where idempotency_key is not null;

create function public.marketing_criar_briefing_idempotente(
  p_workspace_id uuid, p_idempotency_key uuid,
  p_titulo text, p_objetivo text default '',
  p_publico text default '', p_pilar text default '', p_formato text default 'CARROSSEL',
  p_data_planejada date default null, p_hipotese text default '',
  p_preparar_estrategia boolean default false
)
returns public.marketing_content_item language plpgsql security definer set search_path = '' as $$
declare
  v_item public.marketing_content_item;
  v_status public.marketing_content_status;
begin
  if auth.uid() is null or not public.marketing_eh_membro(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Membro do workspace necessário';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22004', message = 'Chave de idempotência obrigatória';
  end if;

  v_status = public.marketing_status_briefing(
    p_titulo, p_objetivo, p_publico, p_pilar,
    p_data_planejada, p_hipotese, p_preparar_estrategia
  );

  insert into public.marketing_content_item as c (
    workspace_id, criado_por, idempotency_key, titulo, objetivo, publico, pilar,
    formato, data_planejada, hipotese, status
  ) values (
    p_workspace_id, auth.uid(), p_idempotency_key, pg_catalog.btrim(p_titulo),
    p_objetivo, p_publico, p_pilar, p_formato, p_data_planejada, p_hipotese, v_status
  )
  on conflict (workspace_id, criado_por, idempotency_key)
    where idempotency_key is not null
  do nothing
  returning c.* into v_item;

  if found then return v_item; end if;

  select c.* into strict v_item
    from public.marketing_content_item as c
   where c.workspace_id = p_workspace_id
     and c.criado_por = auth.uid()
     and c.idempotency_key = p_idempotency_key;

  if v_item.titulo is distinct from pg_catalog.btrim(p_titulo)
     or v_item.objetivo is distinct from p_objetivo
     or v_item.publico is distinct from p_publico
     or v_item.pilar is distinct from p_pilar
     or v_item.formato is distinct from p_formato
     or v_item.data_planejada is distinct from p_data_planejada
     or v_item.hipotese is distinct from p_hipotese
     or v_item.status is distinct from v_status then
    raise exception using
      errcode = '22023',
      message = 'Chave de idempotência reutilizada com outro briefing';
  end if;
  return v_item;
end;
$$;

-- ---------- menor privilégio para funções Marketing ----------

do $$
declare
  v_funcao record;
begin
  for v_funcao in
    select p.oid::pg_catalog.regprocedure::text as assinatura
      from pg_catalog.pg_proc as p
      join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'marketing\_%' escape '\'
  loop
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated',
      v_funcao.assinatura
    );
  end loop;
end;
$$;

grant execute on function public.marketing_eh_membro(uuid) to authenticated;
grant execute on function public.marketing_eh_admin(uuid) to authenticated;
grant execute on function public.marketing_criar_workspace(text, uuid) to authenticated;
grant execute on function public.marketing_atualizar_workspace_nome(uuid, text) to authenticated;
grant execute on function public.marketing_adicionar_membro(uuid, uuid, public.marketing_member_role) to authenticated;
grant execute on function public.marketing_alterar_papel_membro(uuid, uuid, public.marketing_member_role) to authenticated;
grant execute on function public.marketing_remover_membro(uuid, uuid) to authenticated;
grant execute on function public.marketing_criar_briefing(uuid, text, text, text, text, text, date, text, boolean) to authenticated;
grant execute on function public.marketing_criar_briefing_idempotente(uuid, uuid, text, text, text, text, text, date, text, boolean) to authenticated;
grant execute on function public.marketing_atualizar_briefing(uuid, uuid, bigint, text, text, text, text, text, date, text, boolean) to authenticated;

commit;
