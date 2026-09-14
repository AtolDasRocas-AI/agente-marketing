-- ============================================================
-- Nova regra de qualificação: palavra/hashtag obrigatória.
-- Ex.: só vale comentário que contenha "EU QUERO" ou "#atolreef".
-- Comparação é case-insensitive e ignora acentos no motor.
-- ============================================================

alter table sorteio add column if not exists palavra_chave text;

comment on column sorteio.palavra_chave is
  'Texto que o comentário precisa conter para ser habilitado. NULL = regra desativada.';
