-- ATOL Studio — posts "informativos" (checklist/dica/estatística): o texto que aparece
-- sobre a imagem é composto no navegador, de forma determinística e exata (nunca "escrito"
-- pela IA de imagem, que erra grafia com frequência), e persistido como mais uma linha em
-- marketing_image_asset, apontando para a imagem de fundo que lhe deu origem.

begin;
set local lock_timeout = '5s';

alter table public.marketing_image_asset
  add column origem_imagem_id uuid references public.marketing_image_asset(id) on delete restrict,
  add column texto_overlay jsonb;

commit;
