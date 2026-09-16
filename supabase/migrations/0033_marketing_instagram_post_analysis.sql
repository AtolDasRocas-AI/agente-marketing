-- ATOL Studio — Onda 5 do spec-kit "Análise Avançada de Instagram": análise de IA por
-- post individual (leitura + sugestão), versionada e append-only. Gerada automaticamente
-- quando o post matura (7 dias) ou sob pedido manual — nunca reprocessa sozinha depois.

begin;
set local lock_timeout = '5s';

alter table public.marketing_ai_run drop constraint marketing_ai_run_operacao_check;
alter table public.marketing_ai_run add constraint marketing_ai_run_operacao_check check (operacao in (
  'ESTRATEGIA', 'ANGULO', 'LEGENDA', 'CTA', 'PROMPT_IMAGEM',
  'CLASSIFICAR_COMENTARIO', 'GERAR_INSIGHT', 'GERAR_IMAGEM', 'ANALISAR_POST'
));

create table public.marketing_instagram_post_analysis (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  ig_media_id text not null check (char_length(btrim(ig_media_id)) between 1 and 128),
  numero integer not null default 1 check (numero > 0),
  analise text not null check (char_length(analise) <= 4000),
  sugestao text not null default '' check (char_length(sugestao) <= 2000),
  modelo_ia text not null check (char_length(btrim(modelo_ia)) between 1 and 160),
  custo_usd numeric(12, 6) check (custo_usd is null or (custo_usd >= 0 and custo_usd::text <> 'NaN')),
  ai_run_id uuid,
  solicitado_por uuid not null references auth.users(id) on delete restrict,
  origem text not null default 'AUTOMATICA' check (origem in ('AUTOMATICA', 'MANUAL')),
  gerado_em timestamptz not null default now(),
  constraint marketing_instagram_post_analysis_media_fk
    foreign key (workspace_id, ig_media_id)
    references public.marketing_instagram_media (workspace_id, ig_media_id) on delete restrict,
  constraint marketing_instagram_post_analysis_uk unique (workspace_id, ig_media_id, numero)
);
create index marketing_instagram_post_analysis_latest_idx
  on public.marketing_instagram_post_analysis (workspace_id, ig_media_id, numero desc);

alter table public.marketing_instagram_post_analysis enable row level security;
create policy marketing_instagram_post_analysis_select on public.marketing_instagram_post_analysis
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
revoke all privileges on table public.marketing_instagram_post_analysis from public, anon, authenticated, service_role;
grant select on table public.marketing_instagram_post_analysis to authenticated, service_role;
grant insert on table public.marketing_instagram_post_analysis to service_role;

-- Append-only: uma reanálise sempre insere numero+1, nunca sobrescreve a versão anterior.
create trigger marketing_instagram_post_analysis_append_only
before update or delete on public.marketing_instagram_post_analysis
for each row execute function public.marketing_bloquear_mutacao_append_only();

alter table public.marketing_audit_event drop constraint if exists marketing_audit_event_entidade_check;
alter table public.marketing_audit_event add constraint marketing_audit_event_entidade_check check (entidade in (
  'marketing_workspace', 'marketing_member', 'marketing_content_item', 'marketing_ai_run',
  'marketing_cost_ledger', 'marketing_ai_budget', 'marketing_content_version',
  'marketing_content_approval', 'marketing_instagram_connection', 'marketing_instagram_metric_snapshot',
  'marketing_context_note', 'marketing_instagram_import_run', 'marketing_instagram_comment_snapshot',
  'marketing_insight', 'marketing_image_asset', 'marketing_instagram_media',
  'marketing_instagram_account_metric_daily', 'marketing_instagram_post_analysis'
));
create trigger marketing_instagram_post_analysis_audit after insert on public.marketing_instagram_post_analysis
for each row execute function public.marketing_auditar_mutacao();

comment on table public.marketing_instagram_post_analysis is
  'Análise de IA por post (leitura + sugestão), versionada e append-only. Automática quando o post matura (7 dias) ou sob pedido manual de reanálise — nunca reprocessa sozinha depois da primeira vez.';

commit;
