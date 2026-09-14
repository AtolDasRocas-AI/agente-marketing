-- ============================================================
-- 1. Novo status EXTRA: comentário adicional de quem JÁ tem chance.
--    Antes eles apareciam como DESQUALIFICADO, o que dava a impressão
--    errada de que a pessoa tinha sido eliminada. Ela participa
--    normalmente — só não acumula chances.
--
-- 2. marcar_suspeitos: as heurísticas anti-bot passam a ser opcionais
--    e desligadas por padrão (falso positivo em sorteio gera briga).
--
-- Obs.: `alter type ... add value` não pode ser usado na mesma
-- transação em que o valor é gravado — por isso a atualização dos
-- registros antigos vive na migração 0010.
-- ============================================================

alter type status_qualif add value if not exists 'EXTRA';

alter table sorteio
  add column if not exists marcar_suspeitos boolean not null default false;

comment on column sorteio.marcar_suspeitos is
  'Liga as heurísticas anti-bot (texto clonado, rajada, excesso de menções). Padrão: desligado.';
