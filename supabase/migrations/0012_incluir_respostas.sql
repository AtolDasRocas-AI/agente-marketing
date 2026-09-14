-- ============================================================
-- Respostas (replies) participando do sorteio — configurável.
--
-- O `comments_count` da API conta apenas comentários de 1º nível;
-- as respostas vêm por cima (auditoria de 2026-08-21: 2009 de 1º
-- nível + 341 respostas nos 31 posts). Até agora as respostas eram
-- sempre descartadas (premissa P-01). Passa a ser opção por sorteio,
-- desligada por padrão.
-- ============================================================

alter table sorteio
  add column if not exists incluir_respostas boolean not null default false;

comment on column sorteio.incluir_respostas is
  'Se verdadeiro, respostas a comentários também concorrem. Padrão: só 1º nível.';
