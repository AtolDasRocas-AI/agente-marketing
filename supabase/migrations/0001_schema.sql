-- ============================================================
-- Sorteio ATOL — Schema inicial (Onda 1)
-- Nota de segurança: o access_token vive em schema PRIVADO
-- (privado.ig_token), sem policy de leitura — só service_role.
-- ============================================================

-- ============ CONTAS ============
create table ig_account (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  ig_user_id      text not null,
  username        text not null,
  token_expira_em timestamptz not null,
  criado_em       timestamptz not null default now(),
  unique (user_id, ig_user_id)
);

-- Tokens em schema privado, fora do search_path da API
create schema if not exists privado;

create table privado.ig_token (
  account_id   uuid primary key references ig_account(id) on delete cascade,
  access_token text not null,
  atualizado_em timestamptz not null default now()
);

-- ============ SORTEIO ============
create type modo_contagem  as enum ('POR_PESSOA', 'POR_COMENTARIO');
create type status_sorteio as enum ('RASCUNHO','IMPORTANDO','PRONTO','ENCERRADO','SORTEADO');

create table sorteio (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references ig_account(id) on delete cascade,
  ig_media_id       text not null,
  permalink         text,
  titulo            text not null,
  status            status_sorteio not null default 'RASCUNHO',

  -- regras (mencoes_minimas padrão 1 — decisão da Rodada 1)
  modo              modo_contagem not null default 'POR_PESSOA',
  teto_chances      int,                       -- só usado em POR_COMENTARIO
  mencoes_minimas   int not null default 1,
  teto_mencoes      int not null default 10,   -- acima disso: suspeita de bot
  janela_inicio     timestamptz,
  janela_fim        timestamptz,
  qtd_vencedores    int not null default 1,
  qtd_suplentes     int not null default 3,

  -- resultado
  seed_publica      text,
  seed_fonte        text,                      -- onde a semente foi publicada (P-06)
  hash_lista        text,

  criado_em         timestamptz not null default now(),
  encerrado_em      timestamptz,
  unique (account_id, ig_media_id, criado_em)
);

-- ============ IMPORTAÇÃO ============
create table import_job (
  id              uuid primary key default gen_random_uuid(),
  sorteio_id      uuid not null references sorteio(id) on delete cascade,
  status          text not null default 'PENDENTE',  -- PENDENTE|RODANDO|CONCLUIDO|ERRO
  cursor_after    text,
  total_importado int not null default 0,
  tentativas      int not null default 0,
  erro            text,
  atualizado_em   timestamptz not null default now()
);

create table comentario (
  id             uuid primary key default gen_random_uuid(),
  sorteio_id     uuid not null references sorteio(id) on delete cascade,
  ig_comment_id  text not null,
  autor_username text,           -- vem de from{username} (achado da Onda 0)
  texto          text not null default '',
  publicado_em   timestamptz not null,
  is_reply       boolean not null default false,
  importado_em   timestamptz not null default now(),
  unique (sorteio_id, ig_comment_id)           -- idempotência (AC-05)
);
create index on comentario (sorteio_id, autor_username);

-- ============ QUALIFICAÇÃO ============
create type status_qualif as enum ('HABILITADO','DESQUALIFICADO','SUSPEITO');

create table qualificacao (
  id              uuid primary key default gen_random_uuid(),
  sorteio_id      uuid not null references sorteio(id) on delete cascade,
  comentario_id   uuid not null references comentario(id) on delete cascade,
  status          status_qualif not null,
  motivo          text,
  mencoes_validas int not null default 0,
  processado_em   timestamptz not null default now(),
  unique (comentario_id)
);

-- lista materializada e ordenada sobre a qual o sorteio roda
create table chance (
  id             uuid primary key default gen_random_uuid(),
  sorteio_id     uuid not null references sorteio(id) on delete cascade,
  ordem          int not null,
  autor_username text not null,
  comentario_id  uuid not null references comentario(id),
  unique (sorteio_id, ordem)
);

-- ============ RESULTADO (append-only, RNF-06) ============
create table resultado (
  id                uuid primary key default gen_random_uuid(),
  sorteio_id        uuid not null references sorteio(id) on delete cascade,
  seed_publica      text not null,
  seed_fonte        text not null,
  hash_lista        text not null,
  total_comentarios int not null,
  total_habilitados int not null,
  total_chances     int not null,
  vencedores        jsonb not null,
  suplentes         jsonb not null,
  executado_em      timestamptz not null default now()
);

-- Imutabilidade: bloqueia UPDATE/DELETE em resultado e comentario (RNF-06)
create or replace function bloquear_mutacao() returns trigger
language plpgsql as $$
begin
  raise exception 'Tabela append-only: % não permite %', tg_table_name, tg_op;
end $$;

create trigger resultado_append_only
  before update or delete on resultado
  for each row execute function bloquear_mutacao();
