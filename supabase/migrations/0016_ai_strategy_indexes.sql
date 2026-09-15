-- ATOL Studio — Sprint 2: índices de apoio às relações de IA.
-- Complementa a 0015 sem alterar regras, dados ou permissões.

begin;
set local lock_timeout = '5s';

create index marketing_ai_budget_atualizado_por_idx
  on public.marketing_ai_budget (atualizado_por);

create index marketing_content_version_ai_run_idx
  on public.marketing_content_version (workspace_id, ai_run_id)
  where ai_run_id is not null;

create index marketing_content_version_criado_por_idx
  on public.marketing_content_version (criado_por);

commit;
