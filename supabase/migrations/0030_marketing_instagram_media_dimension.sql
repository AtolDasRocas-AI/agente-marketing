-- ATOL Studio — Onda 1 do spec-kit "Análise Avançada de Instagram": separa identidade
-- de mídia (dimensão) de observação de métricas (fato) e corrige a dupla contagem.
--
-- Bug corrigido: marketing_instagram_metric_snapshot tem chave (workspace_id,
-- ig_media_id, coletado_em) — cada reimportação grava uma linha nova por post em vez
-- de atualizar a existente. MetricasInstagram.tsx, RelatorioSemanal.tsx e
-- marketing-gerar-insight somavam/contavam todas as linhas do período, então um post
-- reimportado 3x tinha curtidas/comentários contados 3x. O período também usava
-- coletado_em, então um post antigo recapturado hoje entrava no "relatório desta
-- semana" como se fosse novo.
--
-- Esta migração não altera o fato (o histórico de snapshots continua intacto e
-- append-only); adiciona a dimensão de mídia, faz backfill a partir do que já existe,
-- e expõe duas funções de leitura que nunca somam linhas: a última observação por
-- mídia dentro de uma janela, e o delta entre dois pontos no tempo.

begin;
set local lock_timeout = '5s';

create table public.marketing_instagram_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  connection_id uuid not null,
  ig_media_id text not null check (char_length(btrim(ig_media_id)) between 1 and 128),
  media_type text,
  permalink text,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint marketing_instagram_media_workspace_ig_uk unique (workspace_id, ig_media_id),
  constraint marketing_instagram_media_connection_fk
    foreign key (workspace_id, connection_id)
    references public.marketing_instagram_connection(workspace_id, id) on delete restrict
);
create index marketing_instagram_media_publicado_idx
  on public.marketing_instagram_media (workspace_id, publicado_em desc);

-- Backfill: uma linha de dimensão por mídia já observada, usando os dados mais
-- recentes conhecidos dela. Preserva o histórico já coletado antes de travar o fato
-- atrás de uma FK.
insert into public.marketing_instagram_media (
  workspace_id, connection_id, ig_media_id, media_type, permalink, publicado_em
)
select distinct on (s.workspace_id, s.ig_media_id)
  s.workspace_id, s.connection_id, s.ig_media_id, s.media_type, s.permalink, s.publicado_em
  from public.marketing_instagram_metric_snapshot as s
 order by s.workspace_id, s.ig_media_id, s.coletado_em desc
on conflict (workspace_id, ig_media_id) do nothing;

-- Daqui em diante, todo snapshot precisa de uma mídia já identificada na dimensão —
-- o importador deve fazer upsert na dimensão antes de gravar a observação no fato.
alter table public.marketing_instagram_metric_snapshot
  add constraint marketing_instagram_metric_snapshot_media_fk
  foreign key (workspace_id, ig_media_id)
  references public.marketing_instagram_media (workspace_id, ig_media_id) on delete restrict;

alter table public.marketing_instagram_media enable row level security;
create policy marketing_instagram_media_select on public.marketing_instagram_media
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
revoke all privileges on table public.marketing_instagram_media from public, anon, authenticated, service_role;
grant select on table public.marketing_instagram_media to authenticated, service_role;
grant insert, update on table public.marketing_instagram_media to service_role;

alter table public.marketing_audit_event drop constraint if exists marketing_audit_event_entidade_check;
alter table public.marketing_audit_event add constraint marketing_audit_event_entidade_check check (entidade in (
  'marketing_workspace', 'marketing_member', 'marketing_content_item', 'marketing_ai_run',
  'marketing_cost_ledger', 'marketing_ai_budget', 'marketing_content_version',
  'marketing_content_approval', 'marketing_instagram_connection', 'marketing_instagram_metric_snapshot',
  'marketing_context_note', 'marketing_instagram_import_run', 'marketing_instagram_comment_snapshot',
  'marketing_insight', 'marketing_image_asset', 'marketing_instagram_media'
));
create trigger marketing_instagram_media_audit after insert or update on public.marketing_instagram_media
for each row execute function public.marketing_auditar_mutacao();

-- ---------- leitura sem dupla contagem ----------

-- Uma linha por mídia: a observação mais recente com coletado_em <= p_ate, opcionalmente
-- restrita a mídias publicadas dentro de [p_publicado_desde, p_publicado_ate]. Nunca
-- soma linhas do período — é assim que se elimina a dupla contagem por reimportação
-- (AC-01) e o período errado por data de coleta (AC-02).
create function public.marketing_instagram_ultimo_snapshot(
  p_workspace_id uuid,
  p_ate timestamptz default now(),
  p_publicado_desde timestamptz default null,
  p_publicado_ate timestamptz default null
)
returns table (
  ig_media_id text, media_type text, permalink text,
  publicado_em timestamptz, metricas jsonb, coletado_em timestamptz
)
language sql stable set search_path = '' as $$
  select distinct on (s.ig_media_id)
    s.ig_media_id, m.media_type, m.permalink, m.publicado_em, s.metricas, s.coletado_em
    from public.marketing_instagram_metric_snapshot as s
    join public.marketing_instagram_media as m
      on m.workspace_id = s.workspace_id and m.ig_media_id = s.ig_media_id
   where s.workspace_id = p_workspace_id
     and s.coletado_em <= p_ate
     and (p_publicado_desde is null or m.publicado_em >= p_publicado_desde)
     and (p_publicado_ate is null or m.publicado_em <= p_publicado_ate)
   order by s.ig_media_id, s.coletado_em desc;
$$;

-- Uma linha por mídia com observação em (..., p_ate]: o par antes/depois para calcular
-- variação sem somar histórico. metricas_antes vem null quando a mídia não tinha
-- observação anterior a p_desde — post novo dentro da janela, nunca uma queda a zero.
create function public.marketing_instagram_delta_snapshot(
  p_workspace_id uuid,
  p_desde timestamptz,
  p_ate timestamptz default now(),
  p_publicado_desde timestamptz default null,
  p_publicado_ate timestamptz default null
)
returns table (
  ig_media_id text, media_type text, permalink text, publicado_em timestamptz,
  metricas_antes jsonb, coletado_em_antes timestamptz,
  metricas_depois jsonb, coletado_em_depois timestamptz
)
language sql stable set search_path = '' as $$
  with depois as (
    select * from public.marketing_instagram_ultimo_snapshot(
      p_workspace_id, p_ate, p_publicado_desde, p_publicado_ate
    )
  ), antes as (
    select * from public.marketing_instagram_ultimo_snapshot(
      p_workspace_id, p_desde, p_publicado_desde, p_publicado_ate
    )
  )
  select
    d.ig_media_id, d.media_type, d.permalink, d.publicado_em,
    a.metricas as metricas_antes, a.coletado_em as coletado_em_antes,
    d.metricas as metricas_depois, d.coletado_em as coletado_em_depois
    from depois as d
    left join antes as a on a.ig_media_id = d.ig_media_id;
$$;

revoke all on function public.marketing_instagram_ultimo_snapshot(uuid, timestamptz, timestamptz, timestamptz) from public;
revoke all on function public.marketing_instagram_delta_snapshot(uuid, timestamptz, timestamptz, timestamptz, timestamptz) from public;
grant execute on function public.marketing_instagram_ultimo_snapshot(uuid, timestamptz, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.marketing_instagram_delta_snapshot(uuid, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated, service_role;

comment on table public.marketing_instagram_media is
  'Dimensão: identidade de cada publicação do Instagram (1 linha por ig_media_id). marketing_instagram_metric_snapshot é o histórico de observações (fato) — nunca somar suas linhas diretamente, usar marketing_instagram_ultimo_snapshot/marketing_instagram_delta_snapshot.';

commit;
