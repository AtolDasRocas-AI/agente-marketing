-- ATOL Studio — hipóteses semanais de inteligência de produto (Sprint E).
-- Correlaciona métricas, notas de contexto e comentários classificados sem afirmar causalidade.

begin;
set local lock_timeout = '5s';

create table public.marketing_insight (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  ai_run_id uuid,
  periodo_inicio date not null,
  periodo_fim date not null check (periodo_fim >= periodo_inicio),
  entrada_resumida jsonb not null check (pg_catalog.jsonb_typeof(entrada_resumida) = 'object'),
  hipotese text not null check (char_length(btrim(hipotese)) between 1 and 4000),
  evidencias jsonb not null default '[]'::jsonb check (pg_catalog.jsonb_typeof(evidencias) = 'array'),
  limitacoes text not null default '' check (char_length(limitacoes) <= 2000),
  confianca text not null check (confianca in ('BAIXA', 'MEDIA', 'ALTA')),
  proxima_acao text not null default '' check (char_length(proxima_acao) <= 2000),
  custo_usd numeric(12, 6) check (custo_usd is null or (custo_usd >= 0 and custo_usd::text <> 'NaN')),
  modelo_ia text not null check (char_length(btrim(modelo_ia)) between 1 and 160),
  gerado_em timestamptz not null default now(),
  decisao text not null default 'PENDENTE' check (decisao in ('PENDENTE', 'APROVADO', 'DESCARTADO')),
  decidido_por uuid references auth.users(id) on delete restrict,
  decidido_em timestamptz,
  constraint marketing_insight_workspace_id_id_uk unique (workspace_id, id),
  constraint marketing_insight_ai_run_fk
    foreign key (workspace_id, ai_run_id)
    references public.marketing_ai_run (workspace_id, id) on delete restrict,
  constraint marketing_insight_decision_ck check (
    (decisao = 'PENDENTE' and decidido_por is null and decidido_em is null)
    or (decisao in ('APROVADO', 'DESCARTADO') and decidido_por is not null and decidido_em is not null)
  )
);
create index marketing_insight_workspace_idx
  on public.marketing_insight (workspace_id, gerado_em desc);

alter table public.marketing_insight enable row level security;
create policy marketing_insight_select on public.marketing_insight
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
revoke all privileges on table public.marketing_insight from public, anon, authenticated, service_role;
grant select on table public.marketing_insight to authenticated, service_role;
grant insert on table public.marketing_insight to service_role;

alter table public.marketing_audit_event drop constraint if exists marketing_audit_event_entidade_check;
alter table public.marketing_audit_event add constraint marketing_audit_event_entidade_check check (entidade in (
  'marketing_workspace', 'marketing_member', 'marketing_content_item', 'marketing_ai_run',
  'marketing_cost_ledger', 'marketing_ai_budget', 'marketing_content_version',
  'marketing_content_approval', 'marketing_instagram_connection', 'marketing_instagram_metric_snapshot',
  'marketing_context_note', 'marketing_instagram_import_run', 'marketing_instagram_comment_snapshot',
  'marketing_insight'
));
create trigger marketing_insight_audit after insert or update on public.marketing_insight
for each row execute function public.marketing_auditar_mutacao();

create function public.marketing_decidir_insight(p_workspace_id uuid, p_insight_id uuid, p_aprovar boolean)
returns public.marketing_insight
language plpgsql security definer set search_path = '' as $$
declare
  v_insight public.marketing_insight;
begin
  if auth.uid() is null or not public.marketing_eh_admin(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Administrador do workspace necessário';
  end if;
  select * into v_insight from public.marketing_insight
   where workspace_id = p_workspace_id and id = p_insight_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Hipótese não encontrada'; end if;
  if v_insight.decisao <> 'PENDENTE' then
    raise exception using errcode = '55000', message = 'Esta hipótese já foi decidida';
  end if;
  update public.marketing_insight set
    decisao = case when p_aprovar then 'APROVADO' else 'DESCARTADO' end,
    decidido_por = auth.uid(), decidido_em = pg_catalog.now()
   where id = v_insight.id returning * into v_insight;
  return v_insight;
end;
$$;

revoke all on function public.marketing_decidir_insight(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.marketing_decidir_insight(uuid, uuid, boolean) to authenticated;

commit;
