-- ATOL Studio — log auditável de execuções de importação do Instagram (Sprint B).
-- Não altera a leitura já existente; adiciona rastreabilidade de cada execução.

begin;
set local lock_timeout = '5s';

create type public.marketing_import_status as enum ('RODANDO', 'SUCESSO', 'ERRO');
create type public.marketing_import_erro as enum (
  'SEM_DADOS', 'TOKEN_EXPIRADO', 'PERMISSAO_AUSENTE', 'LIMITE_META', 'ERRO_DESCONHECIDO'
);
create type public.marketing_import_tipo as enum ('METRICAS', 'COMENTARIOS');

create table public.marketing_instagram_import_run (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  connection_id uuid not null,
  tipo public.marketing_import_tipo not null default 'METRICAS',
  status public.marketing_import_status not null default 'RODANDO',
  tipo_erro public.marketing_import_erro,
  cursor_pagina text,
  quantidade_processada integer not null default 0 check (quantidade_processada >= 0),
  mensagem text check (mensagem is null or char_length(mensagem) <= 2000),
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  constraint marketing_instagram_import_run_workspace_id_id_uk unique (workspace_id, id),
  constraint marketing_instagram_import_run_connection_fk
    foreign key (workspace_id, connection_id)
    references public.marketing_instagram_connection(workspace_id, id) on delete restrict,
  constraint marketing_instagram_import_run_completion_ck check (
    (status = 'RODANDO' and finalizado_em is null)
    or (status in ('SUCESSO', 'ERRO') and finalizado_em is not null)
  ),
  constraint marketing_instagram_import_run_erro_ck check (
    (status = 'ERRO' and tipo_erro is not null and tipo_erro <> 'SEM_DADOS')
    or (status = 'SUCESSO' and (tipo_erro is null or tipo_erro = 'SEM_DADOS'))
    or (status = 'RODANDO' and tipo_erro is null)
  )
);
create index marketing_instagram_import_run_latest_idx
  on public.marketing_instagram_import_run (workspace_id, connection_id, tipo, iniciado_em desc);

alter table public.marketing_instagram_import_run enable row level security;
create policy marketing_instagram_import_run_select on public.marketing_instagram_import_run
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
revoke all privileges on table public.marketing_instagram_import_run from public, anon, authenticated, service_role;
grant select on table public.marketing_instagram_import_run to authenticated, service_role;
grant insert, update on table public.marketing_instagram_import_run to service_role;

alter table public.marketing_audit_event drop constraint if exists marketing_audit_event_entidade_check;
alter table public.marketing_audit_event add constraint marketing_audit_event_entidade_check check (entidade in (
  'marketing_workspace', 'marketing_member', 'marketing_content_item', 'marketing_ai_run',
  'marketing_cost_ledger', 'marketing_ai_budget', 'marketing_content_version',
  'marketing_content_approval', 'marketing_instagram_connection', 'marketing_instagram_metric_snapshot',
  'marketing_context_note', 'marketing_instagram_import_run'
));
create trigger marketing_instagram_import_run_audit after insert or update on public.marketing_instagram_import_run
for each row execute function public.marketing_auditar_mutacao();

commit;
