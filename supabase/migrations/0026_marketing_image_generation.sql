-- ATOL Studio — geração de imagem a partir de prompt aprovado por humano (Sprint F).
-- Nunca gera sem PROMPT_IMAGEM aprovado; nunca publica automaticamente.

begin;
set local lock_timeout = '5s';

create table public.marketing_image_asset (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  content_item_id uuid not null,
  content_version_id uuid not null,
  ai_run_id uuid,
  prompt_aprovado text not null check (char_length(btrim(prompt_aprovado)) between 1 and 4000),
  modelo_ia text not null check (char_length(btrim(modelo_ia)) between 1 and 160),
  custo_usd numeric(12, 6) check (custo_usd is null or (custo_usd >= 0 and custo_usd::text <> 'NaN')),
  storage_path text not null check (char_length(btrim(storage_path)) between 1 and 500),
  gerado_por uuid not null references auth.users(id) on delete restrict,
  gerado_em timestamptz not null default now(),
  constraint marketing_image_asset_workspace_id_id_uk unique (workspace_id, id),
  constraint marketing_image_asset_storage_path_uk unique (storage_path),
  constraint marketing_image_asset_version_fk
    foreign key (workspace_id, content_version_id)
    references public.marketing_content_version (workspace_id, id) on delete restrict,
  constraint marketing_image_asset_ai_run_fk
    foreign key (workspace_id, ai_run_id)
    references public.marketing_ai_run (workspace_id, id) on delete restrict
);
create index marketing_image_asset_version_idx
  on public.marketing_image_asset (workspace_id, content_version_id, gerado_em desc);

alter table public.marketing_image_asset enable row level security;
create policy marketing_image_asset_select on public.marketing_image_asset
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
revoke all privileges on table public.marketing_image_asset from public, anon, authenticated, service_role;
grant select on table public.marketing_image_asset to authenticated, service_role;
grant insert on table public.marketing_image_asset to service_role;

alter table public.marketing_audit_event drop constraint if exists marketing_audit_event_entidade_check;
alter table public.marketing_audit_event add constraint marketing_audit_event_entidade_check check (entidade in (
  'marketing_workspace', 'marketing_member', 'marketing_content_item', 'marketing_ai_run',
  'marketing_cost_ledger', 'marketing_ai_budget', 'marketing_content_version',
  'marketing_content_approval', 'marketing_instagram_connection', 'marketing_instagram_metric_snapshot',
  'marketing_context_note', 'marketing_instagram_import_run', 'marketing_instagram_comment_snapshot',
  'marketing_insight', 'marketing_image_asset'
));
create trigger marketing_image_asset_audit after insert on public.marketing_image_asset
for each row execute function public.marketing_auditar_mutacao();

-- ---------- bucket privado; acesso de leitura decidido por marketing_image_asset, não por pasta ----------

insert into storage.buckets (id, name, public, file_size_limit)
values ('marketing-imagens', 'marketing-imagens', false, 15728640) -- 15 MiB
on conflict (id) do nothing;

create function public.marketing_pode_acessar_objeto_imagem(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.marketing_image_asset as a
     where a.storage_path = p_name and public.marketing_eh_membro(a.workspace_id)
  );
$$;
revoke all on function public.marketing_pode_acessar_objeto_imagem(text) from public, anon;
grant execute on function public.marketing_pode_acessar_objeto_imagem(text) to authenticated;

create policy marketing_imagens_select on storage.objects
  for select to authenticated
  using (bucket_id = 'marketing-imagens' and public.marketing_pode_acessar_objeto_imagem(name));

commit;
