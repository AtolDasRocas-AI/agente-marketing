-- ATOL Studio — corrige marketing_decidir_aprovacao_conteudo (0017): a expressão
-- CASE atribuída a marketing_content_item.status não era convertida para o enum
-- marketing_content_status, e o Postgres rejeitava com 42804 em toda decisão —
-- aprovar/devolver nunca funcionou desde a migração original. Nunca editar 0017;
-- create or replace substitui só o corpo da função.

begin;

create or replace function public.marketing_decidir_aprovacao_conteudo(
  p_workspace_id uuid, p_approval_id uuid, p_aprovar boolean, p_observacao text default ''
)
returns public.marketing_content_approval
language plpgsql security definer set search_path = '' as $$
declare
  v_approval public.marketing_content_approval;
begin
  if auth.uid() is null or not public.marketing_eh_admin(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Administrador do workspace necessário';
  end if;
  select * into v_approval from public.marketing_content_approval
   where workspace_id = p_workspace_id and id = p_approval_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Solicitação de aprovação não encontrada'; end if;
  if v_approval.decisao <> 'PENDENTE' then
    raise exception using errcode = '55000', message = 'Esta aprovação já foi decidida';
  end if;
  update public.marketing_content_approval set
    decisao = case when p_aprovar then 'APROVADO' else 'REPROVADO' end,
    decidido_por = auth.uid(), decidido_em = pg_catalog.now(),
    observacao = pg_catalog.left(coalesce(p_observacao, ''), 1000)
   where id = v_approval.id returning * into v_approval;
  update public.marketing_content_item
     set status = (case when p_aprovar then 'APROVADO' else 'EM_REVISAO' end)::public.marketing_content_status
   where workspace_id = p_workspace_id and id = v_approval.content_item_id;
  return v_approval;
end;
$$;

commit;
