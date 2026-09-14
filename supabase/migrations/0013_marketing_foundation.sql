-- ============================================================
-- ATOL Studio — fundação do domínio Marketing e Conteúdo
--
-- Sprint 0/Sprint 1: arquivo local, ainda NÃO aplicado em Supabase.
-- Não altera tabelas, políticas ou credenciais do módulo Sorteios.
-- O banco da aplicação principal ATOL permanece fora deste projeto.
-- ============================================================

create type marketing_member_role as enum ('ADMINISTRADOR', 'REVISOR');
create type marketing_content_status as enum (
  'IDEIA',
  'EM_BRIEFING',
  'PRONTO_PARA_ESTRATEGIA',
  'EM_ESTRATEGIA',
  'EM_REVISAO',
  'AGUARDANDO_APROVACAO',
  'APROVADO',
  'PUBLICADO'
);

create table marketing_workspace (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 2 and 120),
  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now()
);

create table marketing_member (
  workspace_id uuid not null references marketing_workspace(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel marketing_member_role not null default 'REVISOR',
  criado_em timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table marketing_content_item (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references marketing_workspace(id) on delete cascade,
  criado_por uuid not null references auth.users(id) on delete restrict,
  titulo text not null check (char_length(trim(titulo)) between 1 and 180),
  objetivo text not null default '',
  publico text not null default '',
  pilar text not null default '',
  formato text not null check (formato in ('FEED', 'CARROSSEL')),
  data_planejada date,
  hipotese text not null default '',
  status marketing_content_status not null default 'IDEIA',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index marketing_content_item_agenda_idx
  on marketing_content_item (workspace_id, data_planejada nulls last, criado_em desc);

-- Eventos não são atualizáveis pelo client: formam a trilha de auditoria.
create table marketing_audit_event (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references marketing_workspace(id) on delete cascade,
  entidade text not null,
  entidade_id uuid,
  evento text not null,
  ator_id uuid references auth.users(id) on delete set null,
  metadados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index marketing_audit_event_entidade_idx
  on marketing_audit_event (workspace_id, entidade, entidade_id, criado_em desc);

-- Reservas para Sprint 2: chamadas de IA e custos nunca devem misturar
-- chaves ou registros com Sorteios.
create table marketing_ai_run (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references marketing_workspace(id) on delete cascade,
  content_item_id uuid references marketing_content_item(id) on delete set null,
  solicitado_por uuid references auth.users(id) on delete set null,
  operacao text not null,
  modelo text,
  status text not null default 'PREPARADO' check (status in ('PREPARADO', 'EXECUTANDO', 'CONCLUIDO', 'FALHOU', 'BLOQUEADO')),
  custo_estimado numeric(12, 6),
  custo_real numeric(12, 6),
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create table marketing_cost_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references marketing_workspace(id) on delete cascade,
  ai_run_id uuid references marketing_ai_run(id) on delete set null,
  operacao text not null,
  modelo text,
  custo_estimado numeric(12, 6),
  custo_real numeric(12, 6),
  moeda text not null default 'USD' check (char_length(moeda) = 3),
  criado_em timestamptz not null default now()
);

create or replace function marketing_atualizar_timestamp()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger marketing_content_item_timestamp
  before update on marketing_content_item
  for each row execute function marketing_atualizar_timestamp();

-- Funções de autorização isoladas para impedir políticas recursivas.
create or replace function marketing_eh_membro(p_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from marketing_member m
    where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
  );
$$;

create or replace function marketing_eh_admin(p_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from marketing_member m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.papel = 'ADMINISTRADOR'
  );
$$;

-- Cria o workspace e o primeiro administrador de forma atômica. O client
-- não pode criar workspaces órfãos nem escolher o papel inicial livremente.
create or replace function marketing_criar_workspace(p_nome text)
returns marketing_workspace
language plpgsql security definer set search_path = public as $$
declare
  v_workspace marketing_workspace;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  insert into marketing_workspace (nome, criado_por)
  values (trim(p_nome), auth.uid())
  returning * into v_workspace;

  insert into marketing_member (workspace_id, user_id, papel)
  values (v_workspace.id, auth.uid(), 'ADMINISTRADOR');

  return v_workspace;
end;
$$;

revoke all on function marketing_eh_membro(uuid) from public;
revoke all on function marketing_eh_admin(uuid) from public;
revoke all on function marketing_criar_workspace(text) from public;
grant execute on function marketing_eh_membro(uuid) to authenticated;
grant execute on function marketing_eh_admin(uuid) to authenticated;
grant execute on function marketing_criar_workspace(text) to authenticated;

alter table marketing_workspace enable row level security;
alter table marketing_member enable row level security;
alter table marketing_content_item enable row level security;
alter table marketing_audit_event enable row level security;
alter table marketing_ai_run enable row level security;
alter table marketing_cost_ledger enable row level security;

create policy marketing_workspace_select on marketing_workspace
  for select to authenticated
  using (criado_por = auth.uid() or marketing_eh_membro(id));
create policy marketing_workspace_update on marketing_workspace
  for update to authenticated
  using (marketing_eh_admin(id)) with check (marketing_eh_admin(id));

create policy marketing_member_select on marketing_member
  for select to authenticated
  using (user_id = auth.uid() or marketing_eh_admin(workspace_id));
create policy marketing_member_insert on marketing_member
  for insert to authenticated
  with check (marketing_eh_admin(workspace_id));
create policy marketing_member_update on marketing_member
  for update to authenticated
  using (marketing_eh_admin(workspace_id)) with check (marketing_eh_admin(workspace_id));
create policy marketing_member_delete on marketing_member
  for delete to authenticated
  using (marketing_eh_admin(workspace_id));

create policy marketing_content_select on marketing_content_item
  for select to authenticated using (marketing_eh_membro(workspace_id));
create policy marketing_content_insert on marketing_content_item
  for insert to authenticated
  with check (marketing_eh_membro(workspace_id) and criado_por = auth.uid());
create policy marketing_content_update on marketing_content_item
  for update to authenticated
  using (marketing_eh_membro(workspace_id)) with check (marketing_eh_membro(workspace_id));

create policy marketing_audit_select on marketing_audit_event
  for select to authenticated using (marketing_eh_membro(workspace_id));
create policy marketing_audit_insert on marketing_audit_event
  for insert to authenticated
  with check (marketing_eh_membro(workspace_id) and (ator_id = auth.uid() or ator_id is null));

-- IA e custos serão gravados exclusivamente por Edge Functions no Sprint 2.
create policy marketing_ai_select on marketing_ai_run
  for select to authenticated using (marketing_eh_membro(workspace_id));
create policy marketing_cost_select on marketing_cost_ledger
  for select to authenticated using (marketing_eh_membro(workspace_id));

comment on table marketing_content_item is
  'Agenda e briefing do módulo Marketing. Não possui relação com tabelas do módulo Sorteios.';
comment on table marketing_audit_event is
  'Trilha append-only de ações do Marketing e Conteúdo.';
comment on table marketing_cost_ledger is
  'Ledger independente de custos de IA do Marketing e Conteúdo.';
