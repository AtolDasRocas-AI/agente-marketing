-- ATOL Studio — corrige marketing_insight_audit (0025): o gatilho genérico
-- marketing_auditar_mutacao() captura a linha inteira (antes+depois) em todo
-- UPDATE, e entrada_resumida (todas as métricas usadas na análise) facilmente
-- passa do limite de 32KB em marketing_audit_event — toda decisão (aprovar
-- ou descartar) falhava com 42P17/23514. entrada_resumida já fica preservada
-- na própria linha de marketing_insight; não precisa duplicar no evento de
-- auditoria, só os campos que realmente mudam na decisão.

begin;

create function public.marketing_auditar_insight()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_metadata jsonb;
begin
  if tg_op = 'INSERT' then
    v_metadata = pg_catalog.jsonb_build_object('depois', pg_catalog.jsonb_build_object(
      'id', new.id, 'confianca', new.confianca, 'modelo_ia', new.modelo_ia,
      'custo_usd', new.custo_usd, 'periodo_inicio', new.periodo_inicio, 'periodo_fim', new.periodo_fim
    ));
  else
    v_metadata = pg_catalog.jsonb_build_object(
      'antes', pg_catalog.jsonb_build_object('decisao', old.decisao),
      'depois', pg_catalog.jsonb_build_object(
        'decisao', new.decisao, 'decidido_por', new.decidido_por, 'decidido_em', new.decidido_em
      )
    );
  end if;

  insert into public.marketing_audit_event (
    workspace_id, entidade, entidade_id, evento, ator_id, origem, metadados
  ) values (
    new.workspace_id, 'marketing_insight', new.id, tg_op, auth.uid(),
    case when auth.uid() is null then 'SISTEMA' else 'USUARIO' end,
    v_metadata
  );
  return null;
end;
$$;

revoke all on function public.marketing_auditar_insight() from public;

drop trigger if exists marketing_insight_audit on public.marketing_insight;
create trigger marketing_insight_audit after insert or update on public.marketing_insight
for each row execute function public.marketing_auditar_insight();

commit;
