-- ============================================================
-- ATOL Studio — fundação segura do domínio Marketing e Conteúdo
--
-- Sprint 0/Sprint 1: arquivo local, ainda NÃO aplicado em Supabase.
-- Não altera tabelas, políticas ou credenciais do módulo Sorteios.
-- O banco da aplicação principal ATOL permanece fora deste projeto.
--
-- Depois da primeira aplicação, este arquivo torna-se imutável.
-- Qualquer correção posterior deve ser criada em uma nova migração.
-- ============================================================

begin;

create type public.marketing_member_role as enum ('ADMINISTRADOR', 'REVISOR');
create type public.marketing_content_status as enum (
  'IDEIA', 'EM_BRIEFING', 'PRONTO_PARA_ESTRATEGIA', 'EM_ESTRATEGIA',
  'EM_REVISAO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'PUBLICADO'
);

create table public.marketing_workspace (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  criado_por uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  criado_em timestamptz not null default now(),
  constraint marketing_workspace_creator_idempotency_uk unique (criado_por, idempotency_key)
);

create table public.marketing_member (
  workspace_id uuid not null references public.marketing_workspace(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  papel public.marketing_member_role not null default 'REVISOR',
  criado_em timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index marketing_member_user_workspace_idx
  on public.marketing_member (user_id, workspace_id);

create table public.marketing_content_item (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete cascade,
  criado_por uuid not null references auth.users(id) on delete restrict,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 180),
  objetivo text not null default '' check (char_length(objetivo) <= 4000),
  publico text not null default '' check (char_length(publico) <= 1000),
  pilar text not null default '' check (char_length(pilar) <= 120),
  formato text not null check (formato in ('FEED', 'CARROSSEL')),
  data_planejada date,
  hipotese text not null default '' check (char_length(hipotese) <= 4000),
  status public.marketing_content_status not null default 'IDEIA',
  versao bigint not null default 1 check (versao > 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint marketing_content_workspace_id_id_uk unique (workspace_id, id)
);
create index marketing_content_item_agenda_idx
  on public.marketing_content_item (workspace_id, data_planejada nulls last, criado_em desc);

-- A auditoria não é apagada junto com o workspace. Workspaces com histórico
-- devem ser desativados futuramente, nunca removidos fisicamente.
create table public.marketing_audit_event (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  entidade text not null check (entidade in (
    'marketing_workspace', 'marketing_member', 'marketing_content_item',
    'marketing_ai_run', 'marketing_cost_ledger'
  )),
  entidade_id uuid,
  evento text not null check (evento in ('INSERT', 'UPDATE', 'DELETE')),
  ator_id uuid,
  origem text not null check (origem in ('USUARIO', 'SISTEMA')),
  metadados jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadados) = 'object' and pg_column_size(metadados) <= 32768
  ),
  criado_em timestamptz not null default now()
);
create index marketing_audit_event_entidade_idx
  on public.marketing_audit_event (workspace_id, entidade, entidade_id, criado_em desc);

-- Reservas para Sprint 2. O gateway server-side será o único escritor.
create table public.marketing_ai_run (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  content_item_id uuid not null,
  solicitado_por uuid not null references auth.users(id) on delete restrict,
  operacao text not null check (operacao in (
    'ESTRATEGIA', 'ANGULO', 'LEGENDA', 'CTA', 'PROMPT_IMAGEM'
  )),
  provedor text not null check (char_length(btrim(provedor)) between 1 and 80),
  modelo text not null check (char_length(btrim(modelo)) between 1 and 160),
  limite_tokens integer not null check (limite_tokens between 1 and 1000000),
  idempotency_key uuid not null,
  status text not null default 'PREPARADO' check (
    status in ('PREPARADO', 'EXECUTANDO', 'CONCLUIDO', 'FALHOU', 'BLOQUEADO')
  ),
  tokens_entrada integer check (tokens_entrada is null or tokens_entrada >= 0),
  tokens_saida integer check (tokens_saida is null or tokens_saida >= 0),
  custo_estimado numeric(12, 6),
  custo_real numeric(12, 6),
  erro_codigo text check (erro_codigo is null or char_length(erro_codigo) <= 120),
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  constraint marketing_ai_run_workspace_id_id_uk unique (workspace_id, id),
  constraint marketing_ai_run_idempotency_uk unique (workspace_id, idempotency_key),
  constraint marketing_ai_run_content_workspace_fk
    foreign key (workspace_id, content_item_id)
    references public.marketing_content_item (workspace_id, id) on delete restrict,
  constraint marketing_ai_run_cost_nonnegative_ck check (
    (custo_estimado is null or (custo_estimado >= 0 and custo_estimado::text <> 'NaN'))
    and (custo_real is null or (custo_real >= 0 and custo_real::text <> 'NaN'))
  ),
  constraint marketing_ai_run_completion_ck check (
    (status in ('PREPARADO', 'EXECUTANDO') and concluido_em is null)
    or (status in ('CONCLUIDO', 'FALHOU', 'BLOQUEADO') and concluido_em is not null)
  )
);
create index marketing_ai_run_workspace_content_idx
  on public.marketing_ai_run (workspace_id, content_item_id, criado_em desc);

-- Ledger append-only. Correções são lançadas como estorno, nunca por UPDATE.
create table public.marketing_cost_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  ai_run_id uuid not null,
  tipo text not null check (tipo in ('RESERVA', 'CONSUMO', 'ESTORNO', 'AJUSTE')),
  idempotency_key uuid not null,
  reverte_ledger_id uuid,
  operacao text not null check (char_length(btrim(operacao)) between 1 and 80),
  modelo text not null check (char_length(btrim(modelo)) between 1 and 160),
  custo_estimado numeric(12, 6),
  custo_real numeric(12, 6),
  moeda text not null default 'USD' check (moeda ~ '^[A-Z]{3}$'),
  criado_em timestamptz not null default now(),
  constraint marketing_cost_ledger_workspace_id_id_uk unique (workspace_id, id),
  constraint marketing_cost_ledger_idempotency_uk unique (workspace_id, idempotency_key),
  constraint marketing_cost_ledger_ai_run_workspace_fk
    foreign key (workspace_id, ai_run_id)
    references public.marketing_ai_run (workspace_id, id) on delete restrict,
  constraint marketing_cost_ledger_reversal_workspace_fk
    foreign key (workspace_id, reverte_ledger_id)
    references public.marketing_cost_ledger (workspace_id, id) on delete restrict,
  constraint marketing_cost_ledger_value_ck check (
    (custo_estimado is not null or custo_real is not null)
    and (custo_estimado is null or (custo_estimado >= 0 and custo_estimado::text <> 'NaN'))
    and (custo_real is null or (custo_real >= 0 and custo_real::text <> 'NaN'))
  ),
  constraint marketing_cost_ledger_reversal_ck check (
    (tipo = 'ESTORNO') = (reverte_ledger_id is not null)
    and reverte_ledger_id is distinct from id
  )
);
create index marketing_cost_ledger_workspace_run_idx
  on public.marketing_cost_ledger (workspace_id, ai_run_id, criado_em desc);
create unique index marketing_cost_ledger_single_reversal_idx
  on public.marketing_cost_ledger (workspace_id, reverte_ledger_id)
  where reverte_ledger_id is not null;

-- ---------- funções internas e invariantes ----------

create function public.marketing_atualizar_content_item()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_em = pg_catalog.now();
  new.versao = old.versao + 1;
  return new;
end;
$$;

create function public.marketing_rejeitar_alteracao_identidade()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using
    errcode = '23514',
    message = pg_catalog.format('Campos de identidade de %I são imutáveis', tg_table_name);
end;
$$;

create function public.marketing_preparar_content_item()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.criado_por = auth.uid();
  elsif new.criado_por is null then
    raise exception using errcode = '23502', message = 'criado_por é obrigatório';
  end if;
  new.criado_em = pg_catalog.now();
  new.atualizado_em = new.criado_em;
  new.versao = 1;
  return new;
end;
$$;

create function public.marketing_proteger_ultimo_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_remove_admin boolean;
begin
  v_remove_admin = old.papel = 'ADMINISTRADOR'::public.marketing_member_role;
  if tg_op <> 'DELETE' then
    v_remove_admin = v_remove_admin
      and new.papel <> 'ADMINISTRADOR'::public.marketing_member_role;
  end if;

  if v_remove_admin then
    perform 1 from public.marketing_workspace as w
     where w.id = old.workspace_id for update;
    if not exists (
      select 1 from public.marketing_member as m
       where m.workspace_id = old.workspace_id
         and m.user_id <> old.user_id
         and m.papel = 'ADMINISTRADOR'::public.marketing_member_role
    ) then
      raise exception using
        errcode = '23514', message = 'O workspace deve manter pelo menos um administrador';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create function public.marketing_bloquear_mutacao_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using
    errcode = '55000',
    message = pg_catalog.format('%I é append-only e não permite %s', tg_table_name, tg_op);
end;
$$;

create function public.marketing_auditar_mutacao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb;
  v_metadata jsonb;
  v_workspace_id uuid;
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_row = pg_catalog.to_jsonb(new);
    v_metadata = pg_catalog.jsonb_build_object('depois', v_row);
  elsif tg_op = 'UPDATE' then
    v_row = pg_catalog.to_jsonb(new);
    v_metadata = pg_catalog.jsonb_build_object(
      'antes', pg_catalog.to_jsonb(old), 'depois', v_row
    );
  else
    v_row = pg_catalog.to_jsonb(old);
    v_metadata = pg_catalog.jsonb_build_object('antes', v_row);
  end if;

  if tg_table_name = 'marketing_workspace' then
    v_workspace_id = (v_row ->> 'id')::uuid;
    v_entity_id = v_workspace_id;
  elsif tg_table_name = 'marketing_member' then
    v_workspace_id = (v_row ->> 'workspace_id')::uuid;
    v_entity_id = (v_row ->> 'user_id')::uuid;
  else
    v_workspace_id = (v_row ->> 'workspace_id')::uuid;
    v_entity_id = (v_row ->> 'id')::uuid;
  end if;

  insert into public.marketing_audit_event (
    workspace_id, entidade, entidade_id, evento, ator_id, origem, metadados
  ) values (
    v_workspace_id, tg_table_name, v_entity_id, tg_op, auth.uid(),
    case when auth.uid() is null then 'SISTEMA' else 'USUARIO' end,
    v_metadata
  );
  return null;
end;
$$;

create trigger marketing_workspace_identidade
before update on public.marketing_workspace
for each row when (
  (old.id, old.criado_por, old.idempotency_key, old.criado_em)
  is distinct from (new.id, new.criado_por, new.idempotency_key, new.criado_em)
)
execute function public.marketing_rejeitar_alteracao_identidade();

create trigger marketing_member_identidade
before update on public.marketing_member
for each row when (
  (old.workspace_id, old.user_id, old.criado_em)
  is distinct from (new.workspace_id, new.user_id, new.criado_em)
)
execute function public.marketing_rejeitar_alteracao_identidade();

create trigger marketing_content_secure_defaults
before insert on public.marketing_content_item
for each row execute function public.marketing_preparar_content_item();

create trigger marketing_content_identidade
before update on public.marketing_content_item
for each row when (
  (old.id, old.workspace_id, old.criado_por, old.criado_em)
  is distinct from (new.id, new.workspace_id, new.criado_por, new.criado_em)
)
execute function public.marketing_rejeitar_alteracao_identidade();

create trigger marketing_content_item_timestamp
before update on public.marketing_content_item
for each row execute function public.marketing_atualizar_content_item();

create trigger marketing_ai_run_identidade
before update on public.marketing_ai_run
for each row when (
  (
    old.id, old.workspace_id, old.content_item_id, old.solicitado_por,
    old.operacao, old.provedor, old.modelo, old.limite_tokens,
    old.idempotency_key, old.criado_em
  ) is distinct from (
    new.id, new.workspace_id, new.content_item_id, new.solicitado_por,
    new.operacao, new.provedor, new.modelo, new.limite_tokens,
    new.idempotency_key, new.criado_em
  )
)
execute function public.marketing_rejeitar_alteracao_identidade();

create trigger marketing_member_last_admin
before update of papel or delete on public.marketing_member
for each row execute function public.marketing_proteger_ultimo_admin();
create trigger marketing_audit_append_only
before update or delete on public.marketing_audit_event
for each row execute function public.marketing_bloquear_mutacao_append_only();
create trigger marketing_cost_ledger_append_only
before update or delete on public.marketing_cost_ledger
for each row execute function public.marketing_bloquear_mutacao_append_only();

create trigger marketing_workspace_audit
after insert or update on public.marketing_workspace
for each row execute function public.marketing_auditar_mutacao();
create trigger marketing_member_audit
after insert or update or delete on public.marketing_member
for each row execute function public.marketing_auditar_mutacao();
create trigger marketing_content_audit
after insert or update or delete on public.marketing_content_item
for each row execute function public.marketing_auditar_mutacao();
create trigger marketing_ai_run_audit
after insert or update on public.marketing_ai_run
for each row execute function public.marketing_auditar_mutacao();
create trigger marketing_cost_ledger_audit
after insert on public.marketing_cost_ledger
for each row execute function public.marketing_auditar_mutacao();

-- ---------- autorização ----------

create function public.marketing_eh_membro(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.marketing_member as m
     where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
  );
$$;

create function public.marketing_eh_admin(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.marketing_member as m
     where m.workspace_id = p_workspace_id
       and m.user_id = auth.uid()
       and m.papel = 'ADMINISTRADOR'::public.marketing_member_role
  );
$$;

create function public.marketing_bloquear_workspace_como_admin(p_workspace_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.marketing_eh_admin(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Administrador do workspace necessário';
  end if;
  perform 1 from public.marketing_workspace as w
   where w.id = p_workspace_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Workspace não encontrado';
  end if;
  if not public.marketing_eh_admin(p_workspace_id) then
    raise exception using
      errcode = '42501', message = 'Permissão administrativa removida durante a operação';
  end if;
end;
$$;

-- ---------- RPCs de workspace e membros ----------

create function public.marketing_criar_workspace(p_nome text, p_idempotency_key uuid)
returns public.marketing_workspace language plpgsql security definer set search_path = '' as $$
declare
  v_workspace public.marketing_workspace;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Não autenticado';
  end if;
  insert into public.marketing_workspace as w (nome, criado_por, idempotency_key)
  values (pg_catalog.btrim(p_nome), auth.uid(), p_idempotency_key)
  on conflict (criado_por, idempotency_key) do nothing
  returning w.* into v_workspace;

  if not found then
    select w.* into strict v_workspace from public.marketing_workspace as w
     where w.criado_por = auth.uid() and w.idempotency_key = p_idempotency_key;
    if not public.marketing_eh_membro(v_workspace.id) then
      raise exception using
        errcode = '42501',
        message = 'O workspace idempotente existe, mas o usuário não é mais membro';
    end if;
    return v_workspace;
  end if;

  insert into public.marketing_member (workspace_id, user_id, papel)
  values (v_workspace.id, auth.uid(), 'ADMINISTRADOR'::public.marketing_member_role);
  return v_workspace;
end;
$$;

create function public.marketing_atualizar_workspace_nome(p_workspace_id uuid, p_nome text)
returns public.marketing_workspace language plpgsql security definer set search_path = '' as $$
declare
  v_workspace public.marketing_workspace;
begin
  perform public.marketing_bloquear_workspace_como_admin(p_workspace_id);
  update public.marketing_workspace as w set nome = pg_catalog.btrim(p_nome)
   where w.id = p_workspace_id returning w.* into v_workspace;
  return v_workspace;
end;
$$;

create function public.marketing_adicionar_membro(
  p_workspace_id uuid, p_user_id uuid,
  p_papel public.marketing_member_role default 'REVISOR'
)
returns public.marketing_member language plpgsql security definer set search_path = '' as $$
declare
  v_member public.marketing_member;
begin
  perform public.marketing_bloquear_workspace_como_admin(p_workspace_id);
  insert into public.marketing_member as m (workspace_id, user_id, papel)
  values (p_workspace_id, p_user_id, p_papel) returning m.* into v_member;
  return v_member;
end;
$$;

create function public.marketing_alterar_papel_membro(
  p_workspace_id uuid, p_user_id uuid, p_papel public.marketing_member_role
)
returns public.marketing_member language plpgsql security definer set search_path = '' as $$
declare
  v_member public.marketing_member;
begin
  perform public.marketing_bloquear_workspace_como_admin(p_workspace_id);
  update public.marketing_member as m set papel = p_papel
   where m.workspace_id = p_workspace_id and m.user_id = p_user_id
  returning m.* into v_member;
  if not found then
    raise exception using errcode = 'P0002', message = 'Membro não encontrado';
  end if;
  return v_member;
end;
$$;

create function public.marketing_remover_membro(p_workspace_id uuid, p_user_id uuid)
returns public.marketing_member language plpgsql security definer set search_path = '' as $$
declare
  v_member public.marketing_member;
begin
  perform public.marketing_bloquear_workspace_como_admin(p_workspace_id);
  delete from public.marketing_member as m
   where m.workspace_id = p_workspace_id and m.user_id = p_user_id
  returning m.* into v_member;
  if not found then
    raise exception using errcode = 'P0002', message = 'Membro não encontrado';
  end if;
  return v_member;
end;
$$;

-- ---------- RPCs de briefing ----------

create function public.marketing_status_briefing(
  p_titulo text, p_objetivo text, p_publico text, p_pilar text,
  p_data_planejada date, p_hipotese text, p_preparar_estrategia boolean
)
returns public.marketing_content_status language plpgsql immutable set search_path = '' as $$
begin
  if pg_catalog.char_length(pg_catalog.btrim(p_titulo)) = 0 then
    raise exception using errcode = '23514', message = 'Título obrigatório';
  end if;
  if p_preparar_estrategia then
    if pg_catalog.char_length(pg_catalog.btrim(p_objetivo)) = 0
       or pg_catalog.char_length(pg_catalog.btrim(p_publico)) = 0
       or pg_catalog.char_length(pg_catalog.btrim(p_pilar)) = 0
       or p_data_planejada is null
       or pg_catalog.char_length(pg_catalog.btrim(p_hipotese)) = 0 then
      raise exception using
        errcode = '23514',
        message = 'Todos os campos do briefing são obrigatórios para preparar estratégia';
    end if;
    return 'PRONTO_PARA_ESTRATEGIA'::public.marketing_content_status;
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_objetivo)) > 0
     or pg_catalog.char_length(pg_catalog.btrim(p_publico)) > 0
     or pg_catalog.char_length(pg_catalog.btrim(p_pilar)) > 0
     or p_data_planejada is not null
     or pg_catalog.char_length(pg_catalog.btrim(p_hipotese)) > 0 then
    return 'EM_BRIEFING'::public.marketing_content_status;
  end if;
  return 'IDEIA'::public.marketing_content_status;
end;
$$;

create function public.marketing_criar_briefing(
  p_workspace_id uuid, p_titulo text, p_objetivo text default '',
  p_publico text default '', p_pilar text default '', p_formato text default 'CARROSSEL',
  p_data_planejada date default null, p_hipotese text default '',
  p_preparar_estrategia boolean default false
)
returns public.marketing_content_item language plpgsql security definer set search_path = '' as $$
declare
  v_item public.marketing_content_item;
  v_status public.marketing_content_status;
begin
  if auth.uid() is null or not public.marketing_eh_membro(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Membro do workspace necessário';
  end if;
  v_status = public.marketing_status_briefing(
    p_titulo, p_objetivo, p_publico, p_pilar,
    p_data_planejada, p_hipotese, p_preparar_estrategia
  );
  insert into public.marketing_content_item as c (
    workspace_id, criado_por, titulo, objetivo, publico, pilar,
    formato, data_planejada, hipotese, status
  ) values (
    p_workspace_id, auth.uid(), pg_catalog.btrim(p_titulo), p_objetivo, p_publico, p_pilar,
    p_formato, p_data_planejada, p_hipotese, v_status
  ) returning c.* into v_item;
  return v_item;
end;
$$;

create function public.marketing_atualizar_briefing(
  p_workspace_id uuid, p_content_item_id uuid, p_versao_esperada bigint,
  p_titulo text, p_objetivo text default '', p_publico text default '',
  p_pilar text default '', p_formato text default 'CARROSSEL',
  p_data_planejada date default null, p_hipotese text default '',
  p_preparar_estrategia boolean default false
)
returns public.marketing_content_item language plpgsql security definer set search_path = '' as $$
declare
  v_item public.marketing_content_item;
  v_status public.marketing_content_status;
begin
  if auth.uid() is null or not public.marketing_eh_membro(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Membro do workspace necessário';
  end if;
  v_status = public.marketing_status_briefing(
    p_titulo, p_objetivo, p_publico, p_pilar,
    p_data_planejada, p_hipotese, p_preparar_estrategia
  );
  update public.marketing_content_item as c
     set titulo = pg_catalog.btrim(p_titulo), objetivo = p_objetivo,
         publico = p_publico, pilar = p_pilar, formato = p_formato,
         data_planejada = p_data_planejada, hipotese = p_hipotese, status = v_status
   where c.id = p_content_item_id and c.workspace_id = p_workspace_id
     and c.versao = p_versao_esperada
     and c.status in ('IDEIA', 'EM_BRIEFING', 'PRONTO_PARA_ESTRATEGIA')
  returning c.* into v_item;
  if not found then
    raise exception using
      errcode = '40001',
      message = 'Briefing inexistente, em outra etapa ou alterado por outra sessão';
  end if;
  return v_item;
end;
$$;

-- ---------- RLS ----------

alter table public.marketing_workspace enable row level security;
alter table public.marketing_member enable row level security;
alter table public.marketing_content_item enable row level security;
alter table public.marketing_audit_event enable row level security;
alter table public.marketing_ai_run enable row level security;
alter table public.marketing_cost_ledger enable row level security;

create policy marketing_workspace_select on public.marketing_workspace
  for select to authenticated using (public.marketing_eh_membro(id));
create policy marketing_member_select on public.marketing_member
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
create policy marketing_content_select on public.marketing_content_item
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
create policy marketing_audit_select on public.marketing_audit_event
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
create policy marketing_ai_select on public.marketing_ai_run
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
create policy marketing_cost_select on public.marketing_cost_ledger
  for select to authenticated using (public.marketing_eh_membro(workspace_id));

-- ---------- privilégios mínimos ----------

revoke all privileges on table
  public.marketing_workspace, public.marketing_member, public.marketing_content_item,
  public.marketing_audit_event, public.marketing_ai_run, public.marketing_cost_ledger
from public, anon, authenticated, service_role;

grant select on table
  public.marketing_workspace, public.marketing_member, public.marketing_content_item,
  public.marketing_audit_event, public.marketing_ai_run, public.marketing_cost_ledger
to authenticated;

grant select, insert, update on public.marketing_ai_run to service_role;
grant select, insert on public.marketing_cost_ledger to service_role;
grant select on public.marketing_workspace, public.marketing_member to service_role;
grant select on public.marketing_content_item, public.marketing_audit_event to service_role;
grant usage on type public.marketing_member_role, public.marketing_content_status
  to authenticated, service_role;

revoke all on function public.marketing_atualizar_content_item() from public;
revoke all on function public.marketing_rejeitar_alteracao_identidade() from public;
revoke all on function public.marketing_preparar_content_item() from public;
revoke all on function public.marketing_proteger_ultimo_admin() from public;
revoke all on function public.marketing_bloquear_mutacao_append_only() from public;
revoke all on function public.marketing_auditar_mutacao() from public;
revoke all on function public.marketing_bloquear_workspace_como_admin(uuid) from public;
revoke all on function public.marketing_status_briefing(text, text, text, text, date, text, boolean) from public;
revoke all on function public.marketing_eh_membro(uuid) from public;
revoke all on function public.marketing_eh_admin(uuid) from public;
revoke all on function public.marketing_criar_workspace(text, uuid) from public;
revoke all on function public.marketing_atualizar_workspace_nome(uuid, text) from public;
revoke all on function public.marketing_adicionar_membro(uuid, uuid, public.marketing_member_role) from public;
revoke all on function public.marketing_alterar_papel_membro(uuid, uuid, public.marketing_member_role) from public;
revoke all on function public.marketing_remover_membro(uuid, uuid) from public;
revoke all on function public.marketing_criar_briefing(uuid, text, text, text, text, text, date, text, boolean) from public;
revoke all on function public.marketing_atualizar_briefing(uuid, uuid, bigint, text, text, text, text, text, date, text, boolean) from public;

grant execute on function public.marketing_eh_membro(uuid) to authenticated;
grant execute on function public.marketing_eh_admin(uuid) to authenticated;
grant execute on function public.marketing_criar_workspace(text, uuid) to authenticated;
grant execute on function public.marketing_atualizar_workspace_nome(uuid, text) to authenticated;
grant execute on function public.marketing_adicionar_membro(uuid, uuid, public.marketing_member_role) to authenticated;
grant execute on function public.marketing_alterar_papel_membro(uuid, uuid, public.marketing_member_role) to authenticated;
grant execute on function public.marketing_remover_membro(uuid, uuid) to authenticated;
grant execute on function public.marketing_criar_briefing(uuid, text, text, text, text, text, date, text, boolean) to authenticated;
grant execute on function public.marketing_atualizar_briefing(uuid, uuid, bigint, text, text, text, text, text, date, text, boolean) to authenticated;

comment on table public.marketing_content_item is
  'Agenda e briefing do Marketing. Sem relação com tabelas do módulo Sorteios.';
comment on table public.marketing_audit_event is
  'Trilha append-only gerada pelo banco para ações do Marketing e Conteúdo.';
comment on table public.marketing_cost_ledger is
  'Ledger append-only e idempotente de custos de IA do Marketing e Conteúdo.';

commit;
