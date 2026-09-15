-- ATOL Studio — comentários do Instagram (Sprint C) e generalização do gateway
-- de IA para operações sem content_item_id (classificação, insight, imagem — Sprints C/E/F).
-- Não altera o comportamento de marketing_iniciar_execucao_ia/marketing_finalizar_execucao_ia.

begin;
set local lock_timeout = '5s';

create table public.marketing_instagram_comment_snapshot (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.marketing_workspace(id) on delete restrict,
  connection_id uuid not null,
  ig_media_id text not null check (char_length(btrim(ig_media_id)) between 1 and 128),
  ig_comment_id text not null check (char_length(btrim(ig_comment_id)) between 1 and 128),
  autor_username text,
  texto text not null default '',
  publicado_em timestamptz,
  coletado_em timestamptz not null default now(),
  categoria text check (categoria in (
    'DUVIDA', 'ELOGIO', 'RECLAMACAO', 'INTENCAO_COMPRA', 'PEDIDO_SUPORTE', 'SPAM', 'NAO_CLASSIFICADO'
  )),
  classificado_em timestamptz,
  modelo_ia text,
  constraint marketing_instagram_comment_workspace_id_id_uk unique (workspace_id, id),
  constraint marketing_instagram_comment_connection_fk
    foreign key (workspace_id, connection_id)
    references public.marketing_instagram_connection(workspace_id, id) on delete restrict,
  constraint marketing_instagram_comment_uk unique (workspace_id, ig_comment_id),
  constraint marketing_instagram_comment_classification_ck check (
    (categoria is null) = (classificado_em is null)
  )
);
create index marketing_instagram_comment_media_idx
  on public.marketing_instagram_comment_snapshot (workspace_id, ig_media_id, coletado_em desc);
create index marketing_instagram_comment_pendentes_idx
  on public.marketing_instagram_comment_snapshot (workspace_id) where categoria is null;

alter table public.marketing_instagram_comment_snapshot enable row level security;
create policy marketing_instagram_comment_select on public.marketing_instagram_comment_snapshot
  for select to authenticated using (public.marketing_eh_membro(workspace_id));
revoke all privileges on table public.marketing_instagram_comment_snapshot from public, anon, authenticated, service_role;
grant select on table public.marketing_instagram_comment_snapshot to authenticated, service_role;
grant insert, update on table public.marketing_instagram_comment_snapshot to service_role;

create function public.marketing_reclassificar_comentario(
  p_workspace_id uuid, p_comentario_id uuid, p_categoria text
)
returns public.marketing_instagram_comment_snapshot
language plpgsql security definer set search_path = '' as $$
declare
  v_comentario public.marketing_instagram_comment_snapshot;
begin
  if auth.uid() is null or not public.marketing_eh_membro(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Membro do workspace necessário';
  end if;
  if p_categoria not in (
    'DUVIDA', 'ELOGIO', 'RECLAMACAO', 'INTENCAO_COMPRA', 'PEDIDO_SUPORTE', 'SPAM', 'NAO_CLASSIFICADO'
  ) then
    raise exception using errcode = '22023', message = 'Categoria inválida';
  end if;
  update public.marketing_instagram_comment_snapshot as c
     set categoria = p_categoria, classificado_em = pg_catalog.now(), modelo_ia = 'HUMANO'
   where c.workspace_id = p_workspace_id and c.id = p_comentario_id
  returning c.* into v_comentario;
  if not found then
    raise exception using errcode = 'P0002', message = 'Comentário não encontrado';
  end if;
  return v_comentario;
end;
$$;

revoke all on function public.marketing_reclassificar_comentario(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.marketing_reclassificar_comentario(uuid, uuid, text) to authenticated;

alter table public.marketing_audit_event drop constraint if exists marketing_audit_event_entidade_check;
alter table public.marketing_audit_event add constraint marketing_audit_event_entidade_check check (entidade in (
  'marketing_workspace', 'marketing_member', 'marketing_content_item', 'marketing_ai_run',
  'marketing_cost_ledger', 'marketing_ai_budget', 'marketing_content_version',
  'marketing_content_approval', 'marketing_instagram_connection', 'marketing_instagram_metric_snapshot',
  'marketing_context_note', 'marketing_instagram_import_run', 'marketing_instagram_comment_snapshot'
));
create trigger marketing_instagram_comment_audit after insert or update on public.marketing_instagram_comment_snapshot
for each row execute function public.marketing_auditar_mutacao();

-- ---------- gateway de IA genérico, sem content_item_id nem marketing_content_version ----------
-- marketing_falhar_execucao_ia (0015) já é genérica o suficiente e é reaproveitada como está.

alter table public.marketing_ai_run alter column content_item_id drop not null;
alter table public.marketing_ai_run drop constraint marketing_ai_run_operacao_check;
alter table public.marketing_ai_run add constraint marketing_ai_run_operacao_check check (operacao in (
  'ESTRATEGIA', 'ANGULO', 'LEGENDA', 'CTA', 'PROMPT_IMAGEM',
  'CLASSIFICAR_COMENTARIO', 'GERAR_INSIGHT', 'GERAR_IMAGEM'
));

create function public.marketing_iniciar_execucao_ia_livre(
  p_workspace_id uuid, p_solicitado_por uuid, p_operacao text, p_provedor text,
  p_modelo text, p_limite_tokens integer, p_idempotency_key uuid, p_custo_estimado numeric
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
    if v_run.solicitado_por <> p_solicitado_por
       or v_run.operacao <> p_operacao
       or v_run.provedor <> p_provedor
       or v_run.modelo <> p_modelo then
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
      p_workspace_id, null, p_solicitado_por, p_operacao, p_provedor, p_modelo,
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
      p_workspace_id, null, p_solicitado_por, p_operacao, p_provedor, p_modelo,
      p_limite_tokens, p_idempotency_key, 'BLOQUEADO', p_custo_estimado,
      'ORCAMENTO_EXCEDIDO', pg_catalog.now()
    ) returning * into v_run;
    return v_run;
  end if;

  insert into public.marketing_ai_run (
    workspace_id, content_item_id, solicitado_por, operacao, provedor, modelo,
    limite_tokens, idempotency_key, status, custo_estimado
  ) values (
    p_workspace_id, null, p_solicitado_por, p_operacao, p_provedor, p_modelo,
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

create function public.marketing_finalizar_execucao_ia_livre(
  p_ai_run_id uuid, p_resposta jsonb, p_tokens_entrada integer, p_tokens_saida integer, p_custo_real numeric
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
  if pg_catalog.jsonb_typeof(p_resposta) <> 'object'
     or p_tokens_entrada < 0 or p_tokens_saida < 0
     or p_custo_real < 0 or p_custo_real::text = 'NaN' then
    raise exception using errcode = '22023', message = 'Resultado de IA inválido';
  end if;

  select * into v_run from public.marketing_ai_run where id = p_ai_run_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Execução de IA não encontrada';
  end if;
  if v_run.status = 'CONCLUIDO' then return v_run; end if;
  if v_run.status <> 'EXECUTANDO' then
    raise exception using errcode = '55000', message = 'Execução de IA não está ativa';
  end if;

  update public.marketing_ai_run
     set status = 'CONCLUIDO', resposta = p_resposta,
         tokens_entrada = p_tokens_entrada, tokens_saida = p_tokens_saida,
         custo_real = p_custo_real, concluido_em = pg_catalog.now()
   where id = v_run.id
  returning * into v_run;

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

  return v_run;
end;
$$;

revoke all on function public.marketing_iniciar_execucao_ia_livre(uuid, uuid, text, text, text, integer, uuid, numeric)
  from public, anon, authenticated;
revoke all on function public.marketing_finalizar_execucao_ia_livre(uuid, jsonb, integer, integer, numeric)
  from public, anon, authenticated;
grant execute on function public.marketing_iniciar_execucao_ia_livre(uuid, uuid, text, text, text, integer, uuid, numeric)
  to service_role;
grant execute on function public.marketing_finalizar_execucao_ia_livre(uuid, jsonb, integer, integer, numeric)
  to service_role;

commit;
