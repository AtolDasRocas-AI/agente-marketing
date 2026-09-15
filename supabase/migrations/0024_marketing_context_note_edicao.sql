-- ATOL Studio — edição e arquivamento auditável de notas de contexto (Sprint D).
-- Editar/arquivar não apaga o registro: a auditoria (marketing_audit_event) guarda antes/depois.

begin;
set local lock_timeout = '5s';

alter table public.marketing_context_note
  add column arquivado_em timestamptz,
  add column editado_em timestamptz;

create trigger marketing_context_note_audit_update after update on public.marketing_context_note
for each row execute function public.marketing_auditar_mutacao();

create function public.marketing_editar_nota_contexto(
  p_workspace_id uuid, p_nota_id uuid, p_titulo text, p_categoria text,
  p_ocorrido_em date, p_nota text, p_fonte_url text default null
)
returns public.marketing_context_note
language plpgsql security definer set search_path = '' as $$
declare
  v_nota public.marketing_context_note;
begin
  if auth.uid() is null or not public.marketing_eh_membro(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Membro do workspace necessário';
  end if;
  if p_categoria not in ('EVENTO', 'CAMPANHA', 'PRODUTO', 'MERCADO', 'IMPRENSA', 'OUTRO') then
    raise exception using errcode = '22023', message = 'Categoria inválida';
  end if;
  update public.marketing_context_note as n
     set titulo = pg_catalog.btrim(p_titulo), categoria = p_categoria, ocorrido_em = p_ocorrido_em,
         nota = pg_catalog.btrim(p_nota), fonte_url = nullif(pg_catalog.btrim(coalesce(p_fonte_url, '')), ''),
         editado_em = pg_catalog.now()
   where n.workspace_id = p_workspace_id and n.id = p_nota_id and n.arquivado_em is null
  returning n.* into v_nota;
  if not found then
    raise exception using errcode = 'P0002', message = 'Nota não encontrada ou já arquivada';
  end if;
  return v_nota;
end;
$$;

create function public.marketing_arquivar_nota_contexto(p_workspace_id uuid, p_nota_id uuid)
returns public.marketing_context_note
language plpgsql security definer set search_path = '' as $$
declare
  v_nota public.marketing_context_note;
begin
  if auth.uid() is null or not public.marketing_eh_membro(p_workspace_id) then
    raise exception using errcode = '42501', message = 'Membro do workspace necessário';
  end if;
  update public.marketing_context_note as n
     set arquivado_em = pg_catalog.now()
   where n.workspace_id = p_workspace_id and n.id = p_nota_id and n.arquivado_em is null
  returning n.* into v_nota;
  if not found then
    raise exception using errcode = 'P0002', message = 'Nota não encontrada ou já arquivada';
  end if;
  return v_nota;
end;
$$;

revoke all on function public.marketing_editar_nota_contexto(uuid, uuid, text, text, date, text, text)
  from public, anon, authenticated;
revoke all on function public.marketing_arquivar_nota_contexto(uuid, uuid) from public, anon, authenticated;
grant execute on function public.marketing_editar_nota_contexto(uuid, uuid, text, text, date, text, text) to authenticated;
grant execute on function public.marketing_arquivar_nota_contexto(uuid, uuid) to authenticated;

commit;
