-- ATOL Studio — Sprint 3: aprovação humana de versões imutáveis.

begin;
set local lock_timeout = '5s';

create table public.marketing_content_approval (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  content_item_id uuid not null,
  content_version_id uuid not null,
  solicitado_por uuid not null references auth.users(id) on delete restrict,
  decisao text not null default 'PENDENTE' check (decisao in ('PENDENTE', 'APROVADO', 'REPROVADO')),
  decidido_por uuid references auth.users(id) on delete restrict,
  observacao text not null default '' check (char_length(observacao) <= 1000),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  constraint marketing_content_approval_workspace_id_id_uk unique (workspace_id, id),
  constraint marketing_content_approval_version_uk unique (workspace_id, content_version_id),
  constraint marketing_content_approval_content_workspace_fk
    foreign key (workspace_id, content_item_id)
    references public.marketing_content_item (workspace_id, id) on delete restrict,
  constraint marketing_content_approval_version_workspace_fk
    foreign key (workspace_id, content_version_id)
    references public.marketing_content_version (workspace_id, id) on delete restrict,
  constraint marketing_content_approval_decision_ck check (
    (decisao = 'PENDENTE' and decidido_por is null and decidido_em is null)
    or (decisao in ('APROVADO', 'REPROVADO') and decidido_por is not null and decidido_em is not null)
  )
);

create index marketing_content_approval_item_idx
  on public.marketing_content_approval (workspace_id, content_item_id, criado_em desc);
create index marketing_content_approval_decidido_por_idx
  on public.marketing_content_approval (decidido_por) where decidido_por is not null;

alter table public.marketing_content_approval enable row level security;
create policy marketing_content_approval_select on public.marketing_content_approval
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
revoke all privileges on table public.marketing_content_approval from public, anon, authenticated, service_role;
grant select on table public.marketing_content_approval to authenticated, service_role;

alter table public.marketing_audit_event
  drop constraint if exists marketing_audit_event_entidade_check;
alter table public.marketing_audit_event
  add constraint marketing_audit_event_entidade_check check (entidade in (
    'marketing_workspace', 'marketing_member', 'marketing_content_item',
    'marketing_ai_run', 'marketing_cost_ledger', 'marketing_ai_budget',
    'marketing_content_version', 'marketing_content_approval'
  ));
create trigger marketing_content_approval_audit
after insert or update on public.marketing_content_approval
for each row execute function public.marketing_auditar_mutacao();

create function public.marketing_solicitar_aprovacao_conteudo(
  p_workspace_id uuid, p_content_item_id uuid, p_content_version_id uuid, p_observacao text default ''
)
returns public.marketing_content_approval
language plpgsql security definer set search_path = '' as $$
declare
  v_approval public.marketing_content_approval;
begin
  if auth.uid() is null or not public.marketing_eh_membro(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Membro do workspace necessário';
  end if;
  perform 1 from public.marketing_content_version
   where workspace_id = p_workspace_id and id = p_content_version_id and content_item_id = p_content_item_id;
  if not found then raise exception using errcode = '22023', message = 'Versão não pertence ao briefing'; end if;
  insert into public.marketing_content_approval (
    workspace_id, content_item_id, content_version_id, solicitado_por, observacao
  ) values (p_workspace_id, p_content_item_id, p_content_version_id, auth.uid(), pg_catalog.left(coalesce(p_observacao, ''), 1000))
  returning * into v_approval;
  update public.marketing_content_item set status = 'AGUARDANDO_APROVACAO'
   where workspace_id = p_workspace_id and id = p_content_item_id;
  return v_approval;
end;
$$;

create function public.marketing_decidir_aprovacao_conteudo(
  p_workspace_id uuid, p_approval_id uuid, p_aprovar boolean, p_observacao text default ''
)
returns public.marketing_content_approval
language plpgsql security definer set search_path = '' as $$
declare
  v_approval public.marketing_content_approval;
begin
  if auth.uid() is null or not public.marketing_eh_admin(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Administrador do workspace necessário';
  end if;
  select * into v_approval from public.marketing_content_approval
   where workspace_id = p_workspace_id and id = p_approval_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Solicitação de aprovação não encontrada'; end if;
  if v_approval.decisao <> 'PENDENTE' then
    raise exception using errcode = '55000', message = 'Esta aprovação já foi decidida';
  end if;
  update public.marketing_content_approval set
    decisao = case when p_aprovar then 'APROVADO' else 'REPROVADO' end,
    decidido_por = auth.uid(), decidido_em = pg_catalog.now(),
    observacao = pg_catalog.left(coalesce(p_observacao, ''), 1000)
   where id = v_approval.id returning * into v_approval;
  update public.marketing_content_item set status = case when p_aprovar then 'APROVADO' else 'EM_REVISAO' end
   where workspace_id = p_workspace_id and id = v_approval.content_item_id;
  return v_approval;
end;
$$;

revoke all on function public.marketing_solicitar_aprovacao_conteudo(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.marketing_decidir_aprovacao_conteudo(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.marketing_solicitar_aprovacao_conteudo(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.marketing_decidir_aprovacao_conteudo(uuid, uuid, boolean, text) to authenticated;

commit;
