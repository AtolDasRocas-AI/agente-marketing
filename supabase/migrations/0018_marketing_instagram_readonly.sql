-- ATOL Studio — Sprint 4: conexão e instantâneos somente-leitura do Instagram.
-- Não concede publicação nem escrita direta ao cliente.

begin;
set local lock_timeout = '5s';

create table public.marketing_instagram_connection (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.marketing_workspace(id) on delete restrict,
  ig_account_id uuid not null unique references public.ig_account(id) on delete restrict,
  username text not null check (char_length(btrim(username)) between 1 and 30),
  conectado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint marketing_instagram_connection_workspace_id_id_uk unique (workspace_id, id)
);

create table public.marketing_instagram_metric_snapshot (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  connection_id uuid not null,
  ig_media_id text not null check (char_length(btrim(ig_media_id)) between 1 and 128),
  permalink text,
  media_type text,
  publicado_em timestamptz,
  metricas jsonb not null check (pg_catalog.jsonb_typeof(metricas) = 'object'),
  coletado_em timestamptz not null default now(),
  constraint marketing_instagram_metric_snapshot_connection_fk
    foreign key (workspace_id, connection_id)
    references public.marketing_instagram_connection(workspace_id, id) on delete restrict,
  constraint marketing_instagram_metric_snapshot_uk unique (workspace_id, ig_media_id, coletado_em)
);
create index marketing_instagram_metric_snapshot_latest_idx
  on public.marketing_instagram_metric_snapshot (workspace_id, ig_media_id, coletado_em desc);

alter table public.marketing_instagram_connection enable row level security;
alter table public.marketing_instagram_metric_snapshot enable row level security;
create policy marketing_instagram_connection_select on public.marketing_instagram_connection
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
create policy marketing_instagram_metric_snapshot_select on public.marketing_instagram_metric_snapshot
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
revoke all privileges on table public.marketing_instagram_connection, public.marketing_instagram_metric_snapshot
  from public, anon, authenticated, service_role;
grant select on table public.marketing_instagram_connection, public.marketing_instagram_metric_snapshot to authenticated, service_role;
grant insert on table public.marketing_instagram_metric_snapshot to service_role;

alter table public.marketing_audit_event drop constraint if exists marketing_audit_event_entidade_check;
alter table public.marketing_audit_event add constraint marketing_audit_event_entidade_check check (entidade in (
  'marketing_workspace', 'marketing_member', 'marketing_content_item', 'marketing_ai_run',
  'marketing_cost_ledger', 'marketing_ai_budget', 'marketing_content_version',
  'marketing_content_approval', 'marketing_instagram_connection', 'marketing_instagram_metric_snapshot'
));
create trigger marketing_instagram_connection_audit after insert or update on public.marketing_instagram_connection
for each row execute function public.marketing_auditar_mutacao();
create trigger marketing_instagram_metric_snapshot_audit after insert on public.marketing_instagram_metric_snapshot
for each row execute function public.marketing_auditar_mutacao();

create function public.marketing_vincular_conta_instagram(p_workspace_id uuid, p_ig_account_id uuid)
returns public.marketing_instagram_connection
language plpgsql security definer set search_path = '' as $$
declare v_connection public.marketing_instagram_connection; v_username text;
begin
  perform public.marketing_bloquear_workspace_como_admin(p_workspace_id);
  select username into v_username from public.ig_account where id = p_ig_account_id and user_id = auth.uid();
  if not found then raise exception using errcode = '42501', message = 'A conta Instagram não pertence ao usuário autenticado'; end if;
  insert into public.marketing_instagram_connection as c (workspace_id, ig_account_id, username, conectado_por)
  values (p_workspace_id, p_ig_account_id, v_username, auth.uid())
  on conflict (workspace_id) do update set ig_account_id = excluded.ig_account_id, username = excluded.username,
    conectado_por = excluded.conectado_por, atualizado_em = pg_catalog.now()
  returning c.* into v_connection;
  return v_connection;
end;
$$;

revoke all on function public.marketing_vincular_conta_instagram(uuid, uuid) from public, anon, authenticated;
grant execute on function public.marketing_vincular_conta_instagram(uuid, uuid) to authenticated;

commit;
