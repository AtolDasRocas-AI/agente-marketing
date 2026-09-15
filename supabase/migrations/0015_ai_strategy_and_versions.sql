-- ============================================================
-- ATOL Studio — Sprint 2: estratégia assistida e custo protegido
-- O provedor externo é chamado somente por Edge Function server-side.
-- ============================================================

begin;
set local lock_timeout = '5s';

alter table public.marketing_ai_run
  add column resposta jsonb,
  add constraint marketing_ai_run_resposta_object_ck
    check (resposta is null or pg_catalog.jsonb_typeof(resposta) = 'object');

create table public.marketing_ai_budget (
  workspace_id uuid primary key references public.marketing_workspace(id) on delete restrict,
  limite_mensal_usd numeric(12, 6) not null default 0
    check (limite_mensal_usd >= 0 and limite_mensal_usd::text <> 'NaN'),
  limite_por_execucao_usd numeric(12, 6) not null default 0
    check (limite_por_execucao_usd >= 0 and limite_por_execucao_usd::text <> 'NaN'),
  atualizado_por uuid not null references auth.users(id) on delete restrict,
  atualizado_em timestamptz not null default now(),
  constraint marketing_ai_budget_workspace_id_uk unique (workspace_id)
);

create table public.marketing_content_version (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  content_item_id uuid not null,
  ai_run_id uuid,
  numero integer not null check (numero > 0),
  operacao text not null check (operacao in (
    'ESTRATEGIA', 'ANGULO', 'LEGENDA', 'CTA', 'PROMPT_IMAGEM'
  )),
  origem text not null check (origem in ('IA', 'HUMANO')),
  conteudo jsonb not null check (pg_catalog.jsonb_typeof(conteudo) = 'object'),
  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  constraint marketing_content_version_workspace_id_id_uk unique (workspace_id, id),
  constraint marketing_content_version_content_numero_uk
    unique (workspace_id, content_item_id, operacao, numero),
  constraint marketing_content_version_content_workspace_fk
    foreign key (workspace_id, content_item_id)
    references public.marketing_content_item (workspace_id, id) on delete restrict,
  constraint marketing_content_version_ai_run_workspace_fk
    foreign key (workspace_id, ai_run_id)
    references public.marketing_ai_run (workspace_id, id) on delete restrict
);

create index marketing_content_version_content_idx
  on public.marketing_content_version (workspace_id, content_item_id, criado_em desc);

alter table public.marketing_audit_event
  drop constraint if exists marketing_audit_event_entidade_check;
alter table public.marketing_audit_event
  add constraint marketing_audit_event_entidade_check check (entidade in (
    'marketing_workspace', 'marketing_member', 'marketing_content_item',
    'marketing_ai_run', 'marketing_cost_ledger', 'marketing_ai_budget',
    'marketing_content_version'
  ));

alter table public.marketing_ai_budget enable row level security;
alter table public.marketing_content_version enable row level security;

create policy marketing_ai_budget_select on public.marketing_ai_budget
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
create policy marketing_content_version_select on public.marketing_content_version
  for select to authenticated using (public.marketing_eh_membro(workspace_id));

revoke all privileges on table public.marketing_ai_budget, public.marketing_content_version
  from public, anon, authenticated, service_role;
grant select on table public.marketing_ai_budget, public.marketing_content_version
  to authenticated;
grant select on table public.marketing_ai_budget to service_role;
grant select, insert on table public.marketing_content_version to service_role;

create trigger marketing_content_version_append_only
before update or delete on public.marketing_content_version
for each row execute function public.marketing_bloquear_mutacao_append_only();
create trigger marketing_ai_budget_audit
after insert or update on public.marketing_ai_budget
for each row execute function public.marketing_auditar_mutacao();
create trigger marketing_content_version_audit
after insert on public.marketing_content_version
for each row execute function public.marketing_auditar_mutacao();

create function public.marketing_configurar_orcamento_ia(
  p_workspace_id uuid,
  p_limite_mensal_usd numeric,
  p_limite_por_execucao_usd numeric
)
returns public.marketing_ai_budget
language plpgsql security definer set search_path = '' as $$
declare
  v_budget public.marketing_ai_budget;
begin
  if auth.uid() is null or not public.marketing_eh_admin(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Administrador do workspace necessário';
  end if;
  if p_limite_mensal_usd < 0 or p_limite_por_execucao_usd < 0
     or p_limite_mensal_usd::text = 'NaN' or p_limite_por_execucao_usd::text = 'NaN' then
    raise exception using errcode = '22023', message = 'Os limites de IA precisam ser valores não negativos';
  end if;

  insert into public.marketing_ai_budget as b (
    workspace_id, limite_mensal_usd, limite_por_execucao_usd, atualizado_por
  ) values (
    p_workspace_id, p_limite_mensal_usd, p_limite_por_execucao_usd, auth.uid()
  )
  on conflict (workspace_id) do update
    set limite_mensal_usd = excluded.limite_mensal_usd,
        limite_por_execucao_usd = excluded.limite_por_execucao_usd,
        atualizado_por = excluded.atualizado_por,
        atualizado_em = pg_catalog.now()
  returning b.* into v_budget;

  return v_budget;
end;
$$;

-- Esta RPC é exclusiva do serviço: a Edge Function já valida o usuário,
-- escolhe o modelo e só então reserva o teto de custo no banco.
create function public.marketing_iniciar_execucao_ia(
  p_workspace_id uuid,
  p_content_item_id uuid,
  p_solicitado_por uuid,
  p_operacao text,
  p_provedor text,
  p_modelo text,
  p_limite_tokens integer,
  p_idempotency_key uuid,
  p_custo_estimado numeric
)
returns public.marketing_ai_run
language plpgsql security definer set search_path = '' as $$
declare
  v_run public.marketing_ai_run;
  v_budget public.marketing_ai_budget;
  v_consumido numeric(12, 6);
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Operação exclusiva do serviço';
  end if;
  if p_custo_estimado < 0 or p_custo_estimado::text = 'NaN' then
    raise exception using errcode = '22023', message = 'Custo estimado inválido';
  end if;
  if not exists (
    select 1 from public.marketing_member
     where workspace_id = p_workspace_id and user_id = p_solicitado_por
  ) then
    raise exception using errcode = '42501', message = 'Solicitante não pertence ao workspace';
  end if;

  select * into v_run
    from public.marketing_ai_run
   where workspace_id = p_workspace_id and idempotency_key = p_idempotency_key;
  if found then
    if v_run.content_item_id <> p_content_item_id
       or v_run.solicitado_por <> p_solicitado_por
       or v_run.operacao <> p_operacao
       or v_run.provedor <> p_provedor
       or v_run.modelo <> p_modelo
       or v_run.limite_tokens <> p_limite_tokens then
      raise exception using errcode = '22023', message = 'Chave de idempotência reutilizada com outra execução de IA';
    end if;
    return v_run;
  end if;

  select * into v_budget
    from public.marketing_ai_budget
   where workspace_id = p_workspace_id
   for update;

  if not found or v_budget.limite_mensal_usd <= 0 or v_budget.limite_por_execucao_usd <= 0 then
    insert into public.marketing_ai_run (
      workspace_id, content_item_id, solicitado_por, operacao, provedor, modelo,
      limite_tokens, idempotency_key, status, custo_estimado, erro_codigo, concluido_em
    ) values (
      p_workspace_id, p_content_item_id, p_solicitado_por, p_operacao, p_provedor, p_modelo,
      p_limite_tokens, p_idempotency_key, 'BLOQUEADO', p_custo_estimado,
      'ORCAMENTO_NAO_CONFIGURADO', pg_catalog.now()
    ) returning * into v_run;
    return v_run;
  end if;

  select coalesce(sum(
    case when tipo = 'ESTORNO' then -coalesce(custo_real, custo_estimado, 0)
         else coalesce(custo_real, custo_estimado, 0)
    end
  ), 0) into v_consumido
    from public.marketing_cost_ledger
   where workspace_id = p_workspace_id
     and pg_catalog.date_trunc('month', criado_em) = pg_catalog.date_trunc('month', pg_catalog.now());

  if p_custo_estimado > v_budget.limite_por_execucao_usd
     or v_consumido + p_custo_estimado > v_budget.limite_mensal_usd then
    insert into public.marketing_ai_run (
      workspace_id, content_item_id, solicitado_por, operacao, provedor, modelo,
      limite_tokens, idempotency_key, status, custo_estimado, erro_codigo, concluido_em
    ) values (
      p_workspace_id, p_content_item_id, p_solicitado_por, p_operacao, p_provedor, p_modelo,
      p_limite_tokens, p_idempotency_key, 'BLOQUEADO', p_custo_estimado,
      'ORCAMENTO_EXCEDIDO', pg_catalog.now()
    ) returning * into v_run;
    return v_run;
  end if;

  insert into public.marketing_ai_run (
    workspace_id, content_item_id, solicitado_por, operacao, provedor, modelo,
    limite_tokens, idempotency_key, status, custo_estimado
  ) values (
    p_workspace_id, p_content_item_id, p_solicitado_por, p_operacao, p_provedor, p_modelo,
    p_limite_tokens, p_idempotency_key, 'EXECUTANDO', p_custo_estimado
  ) returning * into v_run;

  insert into public.marketing_cost_ledger (
    workspace_id, ai_run_id, tipo, idempotency_key, operacao, modelo, custo_estimado
  ) values (
    p_workspace_id, v_run.id, 'RESERVA', gen_random_uuid(), p_operacao, p_modelo, p_custo_estimado
  );

  return v_run;
end;
$$;

create function public.marketing_finalizar_execucao_ia(
  p_ai_run_id uuid,
  p_resposta jsonb,
  p_tokens_entrada integer,
  p_tokens_saida integer,
  p_custo_real numeric
)
returns public.marketing_content_version
language plpgsql security definer set search_path = '' as $$
declare
  v_run public.marketing_ai_run;
  v_version public.marketing_content_version;
  v_reserva public.marketing_cost_ledger;
  v_numero integer;
  v_tem_reserva boolean;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Operação exclusiva do serviço';
  end if;
  if pg_catalog.jsonb_typeof(p_resposta) <> 'object'
     or p_tokens_entrada < 0 or p_tokens_saida < 0
     or p_custo_real < 0 or p_custo_real::text = 'NaN' then
    raise exception using errcode = '22023', message = 'Resultado de IA inválido';
  end if;

  select * into v_run from public.marketing_ai_run where id = p_ai_run_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Execução de IA não encontrada';
  end if;
  if v_run.status = 'CONCLUIDO' then
    select * into v_version from public.marketing_content_version where ai_run_id = v_run.id;
    return v_version;
  end if;
  if v_run.status <> 'EXECUTANDO' then
    raise exception using errcode = '55000', message = 'Execução de IA não está ativa';
  end if;

  perform 1 from public.marketing_content_item
   where id = v_run.content_item_id and workspace_id = v_run.workspace_id for update;
  select coalesce(max(numero), 0) + 1 into v_numero
    from public.marketing_content_version
   where workspace_id = v_run.workspace_id
     and content_item_id = v_run.content_item_id
     and operacao = v_run.operacao;

  insert into public.marketing_content_version (
    workspace_id, content_item_id, ai_run_id, numero, operacao, origem, conteudo, criado_por
  ) values (
    v_run.workspace_id, v_run.content_item_id, v_run.id, v_numero,
    v_run.operacao, 'IA', p_resposta, v_run.solicitado_por
  ) returning * into v_version;

  update public.marketing_ai_run
     set status = 'CONCLUIDO', resposta = p_resposta,
         tokens_entrada = p_tokens_entrada, tokens_saida = p_tokens_saida,
         custo_real = p_custo_real, concluido_em = pg_catalog.now()
   where id = v_run.id;

  select * into v_reserva from public.marketing_cost_ledger
   where ai_run_id = v_run.id and tipo = 'RESERVA'
   order by criado_em asc limit 1;
  v_tem_reserva = found;
  insert into public.marketing_cost_ledger (
    workspace_id, ai_run_id, tipo, idempotency_key, operacao, modelo, custo_real
  ) values (
    v_run.workspace_id, v_run.id, 'CONSUMO', gen_random_uuid(),
    v_run.operacao, v_run.modelo, p_custo_real
  );
  if v_tem_reserva then
    insert into public.marketing_cost_ledger (
      workspace_id, ai_run_id, tipo, idempotency_key, reverte_ledger_id,
      operacao, modelo, custo_estimado
    ) values (
      v_run.workspace_id, v_run.id, 'ESTORNO', gen_random_uuid(), v_reserva.id,
      v_run.operacao, v_run.modelo, v_reserva.custo_estimado
    );
  end if;

  return v_version;
end;
$$;

create function public.marketing_falhar_execucao_ia(
  p_ai_run_id uuid,
  p_erro_codigo text
)
returns public.marketing_ai_run
language plpgsql security definer set search_path = '' as $$
declare
  v_run public.marketing_ai_run;
  v_reserva public.marketing_cost_ledger;
  v_tem_reserva boolean;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Operação exclusiva do serviço';
  end if;

  select * into v_run from public.marketing_ai_run where id = p_ai_run_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Execução de IA não encontrada';
  end if;
  if v_run.status <> 'EXECUTANDO' then return v_run; end if;

  update public.marketing_ai_run
     set status = 'FALHOU', erro_codigo = pg_catalog.left(coalesce(p_erro_codigo, 'ERRO_DESCONHECIDO'), 120),
         concluido_em = pg_catalog.now()
   where id = v_run.id
  returning * into v_run;

  select * into v_reserva from public.marketing_cost_ledger
   where ai_run_id = v_run.id and tipo = 'RESERVA'
   order by criado_em asc limit 1;
  v_tem_reserva = found;
  if v_tem_reserva then
    insert into public.marketing_cost_ledger (
      workspace_id, ai_run_id, tipo, idempotency_key, reverte_ledger_id,
      operacao, modelo, custo_estimado
    ) values (
      v_run.workspace_id, v_run.id, 'ESTORNO', gen_random_uuid(), v_reserva.id,
      v_run.operacao, v_run.modelo, v_reserva.custo_estimado
    );
  end if;
  return v_run;
end;
$$;

revoke all on function public.marketing_configurar_orcamento_ia(uuid, numeric, numeric)
  from public, anon, authenticated;
revoke all on function public.marketing_iniciar_execucao_ia(uuid, uuid, uuid, text, text, text, integer, uuid, numeric)
  from public, anon, authenticated;
revoke all on function public.marketing_finalizar_execucao_ia(uuid, jsonb, integer, integer, numeric)
  from public, anon, authenticated;
revoke all on function public.marketing_falhar_execucao_ia(uuid, text)
  from public, anon, authenticated;

grant execute on function public.marketing_configurar_orcamento_ia(uuid, numeric, numeric)
  to authenticated;
grant execute on function public.marketing_iniciar_execucao_ia(uuid, uuid, uuid, text, text, text, integer, uuid, numeric)
  to service_role;
grant execute on function public.marketing_finalizar_execucao_ia(uuid, jsonb, integer, integer, numeric)
  to service_role;
grant execute on function public.marketing_falhar_execucao_ia(uuid, text)
  to service_role;

commit;
