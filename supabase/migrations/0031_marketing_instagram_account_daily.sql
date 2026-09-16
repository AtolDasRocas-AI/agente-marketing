-- ATOL Studio — Onda 2 do spec-kit "Análise Avançada de Instagram": série diária de
-- métricas de conta (alcance, visualizações, visitas/toques de perfil, seguidores).
--
-- Ao contrário do fato de mídia (marketing_instagram_metric_snapshot, uma linha por
-- observação), esta tabela é upsertada por dia — a própria Graph API já agrega por
-- period=day, então não há sentido em acumular várias linhas para o mesmo dia; evita
-- reintroduzir a classe de bug corrigida na 0030.

begin;
set local lock_timeout = '5s';

create table public.marketing_instagram_account_metric_daily (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  connection_id uuid not null,
  data date not null,
  seguidores integer check (seguidores is null or seguidores >= 0),
  metricas jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(metricas) = 'object'),
  coletado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint marketing_instagram_account_metric_daily_uk unique (workspace_id, data),
  constraint marketing_instagram_account_metric_daily_connection_fk
    foreign key (workspace_id, connection_id)
    references public.marketing_instagram_connection(workspace_id, id) on delete restrict
);
create index marketing_instagram_account_metric_daily_data_idx
  on public.marketing_instagram_account_metric_daily (workspace_id, data desc);

alter table public.marketing_instagram_account_metric_daily enable row level security;
create policy marketing_instagram_account_metric_daily_select on public.marketing_instagram_account_metric_daily
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
revoke all privileges on table public.marketing_instagram_account_metric_daily from public, anon, authenticated, service_role;
grant select on table public.marketing_instagram_account_metric_daily to authenticated, service_role;
grant insert, update on table public.marketing_instagram_account_metric_daily to service_role;

alter table public.marketing_audit_event drop constraint if exists marketing_audit_event_entidade_check;
alter table public.marketing_audit_event add constraint marketing_audit_event_entidade_check check (entidade in (
  'marketing_workspace', 'marketing_member', 'marketing_content_item', 'marketing_ai_run',
  'marketing_cost_ledger', 'marketing_ai_budget', 'marketing_content_version',
  'marketing_content_approval', 'marketing_instagram_connection', 'marketing_instagram_metric_snapshot',
  'marketing_context_note', 'marketing_instagram_import_run', 'marketing_instagram_comment_snapshot',
  'marketing_insight', 'marketing_image_asset', 'marketing_instagram_media',
  'marketing_instagram_account_metric_daily'
));
create trigger marketing_instagram_account_metric_daily_audit
after insert or update on public.marketing_instagram_account_metric_daily
for each row execute function public.marketing_auditar_mutacao();

comment on table public.marketing_instagram_account_metric_daily is
  'Série diária de métricas de conta do Instagram (alcance, visualizações, visitas/toques de perfil, seguidores) — uma linha por dia, upsertada a cada coleta.';

commit;
