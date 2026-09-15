-- ATOL Studio — notas de contexto para correlacionar eventos e desempenho.

begin;
set local lock_timeout = '5s';

create table public.marketing_context_note (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  criado_por uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  titulo text not null check (char_length(btrim(titulo)) between 2 and 180),
  categoria text not null check (categoria in ('EVENTO', 'CAMPANHA', 'PRODUTO', 'MERCADO', 'IMPRENSA', 'OUTRO')),
  ocorrido_em date not null,
  nota text not null check (char_length(btrim(nota)) between 2 and 4000),
  fonte_url text check (fonte_url is null or char_length(fonte_url) <= 2000),
  criado_em timestamptz not null default now(),
  constraint marketing_context_note_idempotency_uk unique (workspace_id, idempotency_key)
);
create index marketing_context_note_timeline_idx on public.marketing_context_note (workspace_id, ocorrido_em desc, criado_em desc);

alter table public.marketing_context_note enable row level security;
create policy marketing_context_note_select on public.marketing_context_note
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
revoke all privileges on table public.marketing_context_note from public, anon, authenticated, service_role;
grant select on table public.marketing_context_note to authenticated, service_role;

alter table public.marketing_audit_event drop constraint if exists marketing_audit_event_entidade_check;
alter table public.marketing_audit_event add constraint marketing_audit_event_entidade_check check (entidade in (
  'marketing_workspace', 'marketing_member', 'marketing_content_item', 'marketing_ai_run',
  'marketing_cost_ledger', 'marketing_ai_budget', 'marketing_content_version',
  'marketing_content_approval', 'marketing_instagram_connection', 'marketing_instagram_metric_snapshot',
  'marketing_context_note'
));
create trigger marketing_context_note_audit after insert on public.marketing_context_note
for each row execute function public.marketing_auditar_mutacao();

create function public.marketing_criar_nota_contexto(
  p_workspace_id uuid, p_idempotency_key uuid, p_titulo text, p_categoria text,
  p_ocorrido_em date, p_nota text, p_fonte_url text default null
)
returns public.marketing_context_note
language plpgsql security definer set search_path = '' as $$
declare v_note public.marketing_context_note;
begin
  if auth.uid() is null or not public.marketing_eh_membro(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Membro do workspace necessário';
  end if;
  insert into public.marketing_context_note as n (
    workspace_id, criado_por, idempotency_key, titulo, categoria, ocorrido_em, nota, fonte_url
  ) values (
    p_workspace_id, auth.uid(), p_idempotency_key, pg_catalog.btrim(p_titulo), p_categoria,
    p_ocorrido_em, pg_catalog.btrim(p_nota), nullif(pg_catalog.btrim(coalesce(p_fonte_url, '')), '')
  ) on conflict (workspace_id, idempotency_key) do nothing returning n.* into v_note;
  if not found then
    select * into v_note from public.marketing_context_note
      where workspace_id = p_workspace_id and idempotency_key = p_idempotency_key;
  end if;
  return v_note;
end;
$$;

revoke all on function public.marketing_criar_nota_contexto(uuid, uuid, text, text, date, text, text) from public, anon, authenticated;
grant execute on function public.marketing_criar_nota_contexto(uuid, uuid, text, text, date, text, text) to authenticated;

commit;
