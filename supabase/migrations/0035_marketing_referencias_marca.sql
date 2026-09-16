-- ATOL Studio — referências visuais REAIS da marca ATOL (logo oficial, clima visual e
-- telas do app real) para ancorar a geração de imagem por IA além de descrição em texto.
-- Institucional: os mesmos poucos arquivos servem qualquer workspace de marketing, por
-- isso a política de leitura é "é membro de QUALQUER workspace", não amarrada a uma
-- linha por-workspace como em marketing-imagens (0026) — não há dado por-workspace
-- para modelar aqui, então não há tabela nova, só bucket + policy.

begin;
set local lock_timeout = '5s';

insert into storage.buckets (id, name, public, file_size_limit)
values ('marketing-referencias-marca', 'marketing-referencias-marca', false, 5242880) -- 5 MiB
on conflict (id) do nothing;

create function public.marketing_eh_membro_de_algum_workspace()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.marketing_member as m where m.user_id = auth.uid());
$$;
revoke all on function public.marketing_eh_membro_de_algum_workspace() from public, anon;
grant execute on function public.marketing_eh_membro_de_algum_workspace() to authenticated;

create policy marketing_referencias_marca_select on storage.objects
  for select to authenticated
  using (bucket_id = 'marketing-referencias-marca' and public.marketing_eh_membro_de_algum_workspace());

commit;
