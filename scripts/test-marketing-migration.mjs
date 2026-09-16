import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const migrationUrl = new URL('../supabase/migrations/0013_marketing_foundation.sql', import.meta.url);
const sql = await readFile(fileURLToPath(migrationUrl), 'utf8');
const hardeningUrl = new URL('../supabase/migrations/0014_security_and_idempotency.sql', import.meta.url);
const sqlHardening = await readFile(fileURLToPath(hardeningUrl), 'utf8');
const aiStrategyUrl = new URL('../supabase/migrations/0015_ai_strategy_and_versions.sql', import.meta.url);
const sqlAiStrategy = await readFile(fileURLToPath(aiStrategyUrl), 'utf8');
const aiStrategyIndexesUrl = new URL('../supabase/migrations/0016_ai_strategy_indexes.sql', import.meta.url);
const sqlAiStrategyIndexes = await readFile(fileURLToPath(aiStrategyIndexesUrl), 'utf8');
const approvalUrl = new URL('../supabase/migrations/0017_content_approval_workflow.sql', import.meta.url);
const sqlApproval = await readFile(fileURLToPath(approvalUrl), 'utf8');
const instagramReadonlyUrl = new URL('../supabase/migrations/0018_marketing_instagram_readonly.sql', import.meta.url);
const sqlInstagramReadonly = await readFile(fileURLToPath(instagramReadonlyUrl), 'utf8');
const contextNotesUrl = new URL('../supabase/migrations/0019_marketing_context_notes.sql', import.meta.url);
const sqlContextNotes = await readFile(fileURLToPath(contextNotesUrl), 'utf8');
const googleOnlyAuthUrl = new URL('../supabase/migrations/0020_google_only_atol_auth.sql', import.meta.url);
const sqlGoogleOnlyAuth = await readFile(fileURLToPath(googleOnlyAuthUrl), 'utf8');
const restringirAcessoUrl = new URL('../supabase/migrations/0021_restringir_acesso_institucional.sql', import.meta.url);
const sqlRestringirAcesso = await readFile(fileURLToPath(restringirAcessoUrl), 'utf8');
const importRunUrl = new URL('../supabase/migrations/0022_marketing_instagram_import_run.sql', import.meta.url);
const sqlImportRun = await readFile(fileURLToPath(importRunUrl), 'utf8');
const comentariosUrl = new URL('../supabase/migrations/0023_marketing_instagram_comment.sql', import.meta.url);
const sqlComentarios = await readFile(fileURLToPath(comentariosUrl), 'utf8');
const notaEdicaoUrl = new URL('../supabase/migrations/0024_marketing_context_note_edicao.sql', import.meta.url);
const sqlNotaEdicao = await readFile(fileURLToPath(notaEdicaoUrl), 'utf8');
const insightUrl = new URL('../supabase/migrations/0025_marketing_insight.sql', import.meta.url);
const sqlInsight = await readFile(fileURLToPath(insightUrl), 'utf8');
const imagemUrl = new URL('../supabase/migrations/0026_marketing_image_generation.sql', import.meta.url);
const sqlImagem = await readFile(fileURLToPath(imagemUrl), 'utf8');
// 0027 (cron) não entra aqui: pg_cron/pg_net não existem no Postgres descartável do PGlite.
const fixAprovacaoUrl = new URL('../supabase/migrations/0028_fix_aprovacao_status_cast.sql', import.meta.url);
const sqlFixAprovacao = await readFile(fileURLToPath(fixAprovacaoUrl), 'utf8');
const fixAuditoriaInsightUrl = new URL('../supabase/migrations/0029_fix_auditoria_insight.sql', import.meta.url);
const sqlFixAuditoriaInsight = await readFile(fileURLToPath(fixAuditoriaInsightUrl), 'utf8');
const mediaDimensionUrl = new URL('../supabase/migrations/0030_marketing_instagram_media_dimension.sql', import.meta.url);
const sqlMediaDimension = await readFile(fileURLToPath(mediaDimensionUrl), 'utf8');
const accountDailyUrl = new URL('../supabase/migrations/0031_marketing_instagram_account_daily.sql', import.meta.url);
const sqlAccountDaily = await readFile(fileURLToPath(accountDailyUrl), 'utf8');
// 0032 e 0034 (cron) não entram aqui: pg_cron/pg_net não existem no Postgres descartável do PGlite.
const postAnalysisUrl = new URL('../supabase/migrations/0033_marketing_instagram_post_analysis.sql', import.meta.url);
const sqlPostAnalysis = await readFile(fileURLToPath(postAnalysisUrl), 'utf8');

function exige(descricao, padrao) {
  assert.match(sql, padrao, `Migração 0013 sem garantia: ${descricao}`);
}

function proibe(descricao, padrao) {
  assert.doesNotMatch(sql, padrao, `Migração 0013 contém risco proibido: ${descricao}`);
}

assert.equal(sql.trimStart().includes('begin;'), true, 'A migração deve iniciar uma transação explícita.');
assert.equal(sql.trimEnd().endsWith('commit;'), true, 'A migração deve finalizar a transação explicitamente.');
assert.equal(sqlHardening.trimStart().includes('begin;'), true, 'A 0014 deve iniciar uma transação explícita.');
assert.equal(sqlHardening.trimEnd().endsWith('commit;'), true, 'A 0014 deve finalizar a transação explicitamente.');
assert.equal(sqlAiStrategy.trimStart().includes('begin;'), true, 'A 0015 deve iniciar uma transação explícita.');
assert.equal(sqlAiStrategy.trimEnd().endsWith('commit;'), true, 'A 0015 deve finalizar a transação explicitamente.');
assert.equal(sqlAiStrategyIndexes.trimStart().includes('begin;'), true, 'A 0016 deve iniciar uma transação explícita.');
assert.equal(sqlAiStrategyIndexes.trimEnd().endsWith('commit;'), true, 'A 0016 deve finalizar a transação explicitamente.');
assert.equal(sqlApproval.trimStart().includes('begin;'), true, 'A 0017 deve iniciar uma transação explícita.');
assert.equal(sqlApproval.trimEnd().endsWith('commit;'), true, 'A 0017 deve finalizar a transação explicitamente.');
assert.equal(sqlInstagramReadonly.trimStart().includes('begin;'), true, 'A 0018 deve iniciar uma transação explícita.');
assert.equal(sqlInstagramReadonly.trimEnd().endsWith('commit;'), true, 'A 0018 deve finalizar a transação explicitamente.');
assert.equal(sqlContextNotes.trimStart().includes('begin;'), true, 'A 0019 deve iniciar uma transação explícita.');
assert.equal(sqlContextNotes.trimEnd().endsWith('commit;'), true, 'A 0019 deve finalizar a transação explicitamente.');
assert.equal(sqlGoogleOnlyAuth.trimStart().includes('begin;'), true, 'A 0020 deve iniciar uma transação explícita.');
assert.equal(sqlGoogleOnlyAuth.trimEnd().endsWith('commit;'), true, 'A 0020 deve finalizar a transação explicitamente.');
assert.equal(sqlRestringirAcesso.trimStart().includes('begin;'), true, 'A 0021 deve iniciar uma transação explícita.');
assert.equal(sqlRestringirAcesso.trimEnd().endsWith('commit;'), true, 'A 0021 deve finalizar a transação explicitamente.');
assert.equal(sqlImportRun.trimStart().includes('begin;'), true, 'A 0022 deve iniciar uma transação explícita.');
assert.equal(sqlImportRun.trimEnd().endsWith('commit;'), true, 'A 0022 deve finalizar a transação explicitamente.');
assert.equal(sqlComentarios.trimStart().includes('begin;'), true, 'A 0023 deve iniciar uma transação explícita.');
assert.equal(sqlComentarios.trimEnd().endsWith('commit;'), true, 'A 0023 deve finalizar a transação explicitamente.');
assert.equal(sqlNotaEdicao.trimStart().includes('begin;'), true, 'A 0024 deve iniciar uma transação explícita.');
assert.equal(sqlNotaEdicao.trimEnd().endsWith('commit;'), true, 'A 0024 deve finalizar a transação explicitamente.');
assert.equal(sqlInsight.trimStart().includes('begin;'), true, 'A 0025 deve iniciar uma transação explícita.');
assert.equal(sqlInsight.trimEnd().endsWith('commit;'), true, 'A 0025 deve finalizar a transação explicitamente.');
assert.equal(sqlImagem.trimStart().includes('begin;'), true, 'A 0026 deve iniciar uma transação explícita.');
assert.equal(sqlImagem.trimEnd().endsWith('commit;'), true, 'A 0026 deve finalizar a transação explicitamente.');
assert.equal(sqlFixAprovacao.trimStart().includes('begin;'), true, 'A 0028 deve iniciar uma transação explícita.');
assert.equal(sqlFixAprovacao.trimEnd().endsWith('commit;'), true, 'A 0028 deve finalizar a transação explicitamente.');
assert.match(sqlFixAprovacao, /::public\.marketing_content_status/i, 'A 0028 precisa converter o CASE para o enum antes de gravar em status.');
assert.equal(sqlFixAuditoriaInsight.trimStart().includes('begin;'), true, 'A 0029 deve iniciar uma transação explícita.');
assert.equal(sqlFixAuditoriaInsight.trimEnd().endsWith('commit;'), true, 'A 0029 deve finalizar a transação explicitamente.');
assert.match(sqlFixAuditoriaInsight, /create function public\.marketing_auditar_insight/i);
assert.equal(sqlMediaDimension.trimStart().includes('begin;'), true, 'A 0030 deve iniciar uma transação explícita.');
assert.equal(sqlMediaDimension.trimEnd().endsWith('commit;'), true, 'A 0030 deve finalizar a transação explicitamente.');
assert.match(sqlMediaDimension, /create table public\.marketing_instagram_media/i);
assert.match(sqlMediaDimension, /alter table public\.marketing_instagram_metric_snapshot\s*\n\s*add constraint marketing_instagram_metric_snapshot_media_fk/i);
assert.match(sqlMediaDimension, /create function public\.marketing_instagram_ultimo_snapshot/i);
assert.match(sqlMediaDimension, /create function public\.marketing_instagram_delta_snapshot/i);
assert.equal(sqlAccountDaily.trimStart().includes('begin;'), true, 'A 0031 deve iniciar uma transação explícita.');
assert.equal(sqlAccountDaily.trimEnd().endsWith('commit;'), true, 'A 0031 deve finalizar a transação explicitamente.');
assert.match(sqlAccountDaily, /create table public\.marketing_instagram_account_metric_daily/i);
assert.match(sqlAccountDaily, /unique \(workspace_id, data\)/i);
assert.equal(sqlPostAnalysis.trimStart().includes('begin;'), true, 'A 0033 deve iniciar uma transação explícita.');
assert.equal(sqlPostAnalysis.trimEnd().endsWith('commit;'), true, 'A 0033 deve finalizar a transação explicitamente.');
assert.match(sqlPostAnalysis, /create table public\.marketing_instagram_post_analysis/i);
assert.match(sqlPostAnalysis, /'ANALISAR_POST'/);
assert.match(sqlPostAnalysis, /marketing_instagram_post_analysis_append_only[\s\S]*marketing_bloquear_mutacao_append_only/i);
assert.match(sqlHardening, /create unique index if not exists resultado_sorteio_id_uk/i);
assert.match(sqlHardening, /marketing_criar_briefing_idempotente/i);
assert.match(sqlHardening, /revoke delete on table public\.resultado/i);
assert.match(sqlAiStrategy, /create table public\.marketing_ai_budget/i);
assert.match(sqlAiStrategy, /create table public\.marketing_content_version/i);
assert.match(sqlAiStrategy, /marketing_configurar_orcamento_ia/i);
assert.match(sqlAiStrategy, /marketing_iniciar_execucao_ia/i);
assert.match(sqlAiStrategy, /marketing_finalizar_execucao_ia/i);
assert.match(sqlAiStrategyIndexes, /marketing_ai_budget_atualizado_por_idx/i);
assert.match(sqlAiStrategyIndexes, /marketing_content_version_ai_run_idx/i);
assert.match(sqlApproval, /create table public\.marketing_content_approval/i);
assert.match(sqlApproval, /marketing_solicitar_aprovacao_conteudo/i);
assert.match(sqlApproval, /marketing_decidir_aprovacao_conteudo/i);
assert.match(sqlInstagramReadonly, /create table public\.marketing_instagram_connection/i);
assert.match(sqlInstagramReadonly, /marketing_vincular_conta_instagram/i);
assert.match(sqlContextNotes, /create table public\.marketing_context_note/i);
assert.match(sqlContextNotes, /marketing_criar_nota_contexto/i);
assert.match(sqlGoogleOnlyAuth, /hook_permitir_somente_google_atol/i);
assert.match(sqlRestringirAcesso, /create or replace function public\.hook_permitir_somente_google_atol/i);
assert.doesNotMatch(sqlRestringirAcesso, /lipe\.kosse/i, 'A 0021 não deve reintroduzir o e-mail pessoal.');
assert.match(sqlImportRun, /create table public\.marketing_instagram_import_run/i);
assert.match(sqlImportRun, /alter table public\.marketing_instagram_import_run enable row level security/i);
assert.match(sqlComentarios, /create table public\.marketing_instagram_comment_snapshot/i);
assert.match(sqlComentarios, /marketing_iniciar_execucao_ia_livre/i);
assert.match(sqlComentarios, /marketing_finalizar_execucao_ia_livre/i);
assert.match(sqlComentarios, /marketing_reclassificar_comentario/i);
assert.match(sqlNotaEdicao, /marketing_editar_nota_contexto/i);
assert.match(sqlNotaEdicao, /marketing_arquivar_nota_contexto/i);
assert.match(sqlInsight, /create table public\.marketing_insight/i);
assert.match(sqlInsight, /marketing_decidir_insight/i);
assert.match(sqlImagem, /create table public\.marketing_image_asset/i);
assert.match(sqlImagem, /insert into storage\.buckets/i);
assert.match(sqlImagem, /create policy marketing_imagens_select on storage\.objects/i);

const tabelasRls0013 = [
  'marketing_workspace',
  'marketing_member',
  'marketing_content_item',
  'marketing_audit_event',
  'marketing_ai_run',
  'marketing_cost_ledger',
];
const tabelasRls = [
  ...tabelasRls0013,
  'marketing_ai_budget',
  'marketing_content_version',
  'marketing_instagram_media',
  'marketing_instagram_account_metric_daily',
  'marketing_instagram_post_analysis',
];
for (const tabela of tabelasRls0013) {
  exige(`RLS em ${tabela}`, new RegExp(`alter table public\\.${tabela} enable row level security;`, 'i'));
}

exige(
  'execução de IA ligada ao conteúdo do mesmo workspace',
  /foreign key \(workspace_id, content_item_id\)[\s\S]*references public\.marketing_content_item \(workspace_id, id\)/i,
);
exige(
  'ledger ligado à execução do mesmo workspace',
  /foreign key \(workspace_id, ai_run_id\)[\s\S]*references public\.marketing_ai_run \(workspace_id, id\)/i,
);
exige('idempotência do workspace', /unique \(criado_por, idempotency_key\)/i);
exige('idempotência da execução de IA', /unique \(workspace_id, idempotency_key\)/i);
exige('proteção do último administrador', /create trigger marketing_member_last_admin/i);
exige('auditoria append-only', /create trigger marketing_audit_append_only[\s\S]*marketing_bloquear_mutacao_append_only/i);
exige('ledger append-only', /create trigger marketing_cost_ledger_append_only[\s\S]*marketing_bloquear_mutacao_append_only/i);
exige('auditoria automática de conteúdo', /create trigger marketing_content_audit/i);
exige('controle otimista de edição', /p_versao_esperada bigint/i);
exige('status de briefing derivado no banco', /create function public\.marketing_status_briefing/i);
exige('custos não negativos', /marketing_ai_run_cost_nonnegative_ck/i);

const funcoesDefiner = [...sql.matchAll(/create function[\s\S]*?security definer[\s\S]*?as \$\$/gi)];
assert.ok(funcoesDefiner.length >= 8, 'As operações privilegiadas esperadas não foram encontradas.');
for (const funcao of funcoesDefiner) {
  assert.match(funcao[0], /set search_path = ''/i, 'SECURITY DEFINER sem search_path vazio.');
}

proibe('política de escrita direta em membros', /create policy marketing_member_(insert|update|delete)/i);
proibe('política de inserção direta em auditoria', /create policy marketing_audit_insert/i);
proibe('perda de proveniência por SET NULL', /on delete set null/i);
proibe('escrita autenticada direta em auditoria', /grant\s+(insert|update|delete)[\s\S]*marketing_audit_event[\s\S]*to authenticated/i);
proibe('alteração de objetos de Sorteios', /(?:alter|create|drop)\s+(?:table|function|policy|trigger)[^;]*\bsorteio/i);

console.log(`Migração 0013: ${tabelasRls0013.length} tabelas com garantias estáticas verificadas.`);

const usuarioA = '11111111-1111-4111-8111-111111111111';
const usuarioB = '22222222-2222-4222-8222-222222222222';
const usuarioC = '33333333-3333-4333-8333-333333333333';
const workspaceKeyA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const workspaceKeyB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function como(db, papel, usuarioId) {
  await db.exec(`reset role; set role ${papel};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuarioId]);
}

function paraObjeto(valor) {
  return typeof valor === 'string' ? JSON.parse(valor) : valor;
}

async function esperaErro(descricao, acao, codigo) {
  await assert.rejects(
    acao,
    (erro) => {
      assert.equal(erro.code, codigo, `${descricao}: código PostgreSQL inesperado`);
      return true;
    },
    descricao,
  );
}

async function prepararSupabaseDescartavel(db) {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role supabase_auth_admin nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid()
    returns uuid language sql stable set search_path = '' as $$
      select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;

    create table public.import_job (sorteio_id uuid);
    create table public.qualificacao (sorteio_id uuid);
    create table public.chance (comentario_id uuid);
    create table public.resultado (id uuid, sorteio_id uuid);
    create table public.ig_account (
      id uuid primary key,
      user_id uuid not null references auth.users(id),
      username text not null
    );
    create table public._migracoes (nome text primary key);
    create function public.bloquear_mutacao()
    returns trigger language plpgsql as $$ begin raise exception 'imutável'; end; $$;
    alter table public.resultado enable row level security;
    create policy own_resultado_delete on public.resultado
      for delete to authenticated using (true);
    grant delete on public.resultado to authenticated;
    grant select on public._migracoes to anon, authenticated;

    -- Reprodução mínima do schema storage do Supabase (só o suficiente para testar
    -- bucket/policy declarados em migration; não reproduz upload/download reais).
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null,
      public boolean not null default false, file_size_limit bigint
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated, service_role;
    grant select on storage.buckets to anon, authenticated, service_role;
    grant all on storage.objects to service_role;
    grant select, insert on storage.objects to authenticated;
  `);
}

const db = new PGlite();

try {
  await prepararSupabaseDescartavel(db);

  await db.exec(sql);
  await db.exec(sqlHardening);
  await db.exec(sqlAiStrategy);
  await db.exec(sqlAiStrategyIndexes);
  await db.exec(sqlApproval);
  await db.exec(sqlInstagramReadonly);
  await db.exec(sqlContextNotes);
  await db.exec(sqlGoogleOnlyAuth);
  await db.exec(sqlRestringirAcesso);
  await db.exec(sqlImportRun);
  await db.exec(sqlComentarios);
  await db.exec(sqlNotaEdicao);
  await db.exec(sqlInsight);
  await db.exec(sqlImagem);
  await db.exec(sqlFixAprovacao);
  await db.exec(sqlFixAuditoriaInsight);
  await db.exec(sqlMediaDimension);
  await db.exec(sqlAccountDaily);
  await db.exec(sqlPostAnalysis);

  const hookInstitucional = await db.query(
    'select public.hook_permitir_somente_google_atol($1::jsonb) as resultado',
    [JSON.stringify({ user: { email: 'atoldasrocas.ai@gmail.com', app_metadata: { provider: 'google' } } })],
  );
  assert.equal(hookInstitucional.rows[0].resultado.error, undefined, 'A conta institucional deveria ser permitida.');

  const hookNegado = await db.query(
    'select public.hook_permitir_somente_google_atol($1::jsonb) as resultado',
    [JSON.stringify({ user: { email: 'lipe.kosse@gmail.com', app_metadata: { provider: 'google' } } })],
  );
  assert.equal(hookNegado.rows[0].resultado.error.http_code, 403, 'O e-mail pessoal deveria ser bloqueado após a 0021.');

  const endurecimento = await db.query(`
    select
      (select relrowsecurity from pg_catalog.pg_class
        where oid = 'public._migracoes'::pg_catalog.regclass) as migracoes_rls,
      pg_catalog.has_table_privilege('anon', 'public._migracoes', 'SELECT') as anon_migracoes,
      pg_catalog.has_table_privilege('authenticated', 'public.resultado', 'DELETE') as auth_resultado_delete,
      (select count(*)::integer
         from pg_catalog.pg_proc as p
         join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'marketing\\_%' escape '\\'
          and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')) as funcoes_anon
  `);
  assert.equal(endurecimento.rows[0].migracoes_rls, true, '_migracoes permaneceu sem RLS.');
  assert.equal(endurecimento.rows[0].anon_migracoes, false, 'anon ainda lê _migracoes.');
  assert.equal(endurecimento.rows[0].auth_resultado_delete, false, 'authenticated ainda apaga resultado diretamente.');
  assert.equal(endurecimento.rows[0].funcoes_anon, 0, 'anon ainda executa funções Marketing.');

  await db.query(
    'insert into public.resultado (id, sorteio_id) values ($1, $2)',
    ['11111111-aaaa-4111-8111-111111111111', '22222222-aaaa-4222-8222-222222222222'],
  );
  await esperaErro(
    'Um sorteio não pode ter dois resultados',
    () => db.query(
      'insert into public.resultado (id, sorteio_id) values ($1, $2)',
      ['33333333-aaaa-4333-8333-333333333333', '22222222-aaaa-4222-8222-222222222222'],
    ),
    '23505',
  );

  const tabelasCriadas = await db.query(`
    select count(*)::integer as total
      from pg_catalog.pg_class as c
      join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relname = any($1::text[])
  `, [tabelasRls]);
  assert.equal(tabelasCriadas.rows[0].total, tabelasRls.length, 'Nem todas as tabelas foram criadas.');

  const rlsAtivo = await db.query(`
    select count(*)::integer as total
      from pg_catalog.pg_class as c
      join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = any($1::text[])
       and c.relrowsecurity
  `, [tabelasRls]);
  assert.equal(rlsAtivo.rows[0].total, tabelasRls.length, 'RLS não ficou ativo em todas as tabelas.');

  await db.query('insert into auth.users (id) values ($1), ($2), ($3)', [usuarioA, usuarioB, usuarioC]);
  await como(db, 'authenticated', usuarioA);

  const workspaceA = await db.query(
    'select * from public.marketing_criar_workspace($1, $2)',
    ['ATOL Marketing', workspaceKeyA],
  );
  const workspaceIdA = workspaceA.rows[0].id;

  const repeticao = await db.query(
    'select * from public.marketing_criar_workspace($1, $2)',
    ['Nome ignorado pela idempotência', workspaceKeyA],
  );
  assert.equal(repeticao.rows[0].id, workspaceIdA, 'A criação idempotente duplicou o workspace.');

  const briefingKey = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const briefingIdempotente = await db.query(
    'select * from public.marketing_criar_briefing_idempotente($1, $2, $3)',
    [workspaceIdA, briefingKey, 'Ideia idempotente'],
  );
  const briefingRepetido = await db.query(
    'select * from public.marketing_criar_briefing_idempotente($1, $2, $3)',
    [workspaceIdA, briefingKey, 'Ideia idempotente'],
  );
  assert.equal(
    briefingRepetido.rows[0].id,
    briefingIdempotente.rows[0].id,
    'A repetição da criação idempotente gerou outro briefing.',
  );
  await esperaErro(
    'Uma chave idempotente não pode representar outro briefing',
    () => db.query(
      'select * from public.marketing_criar_briefing_idempotente($1, $2, $3)',
      [workspaceIdA, briefingKey, 'Conteúdo diferente'],
    ),
    '22023',
  );

  const membrosIniciais = await db.query(
    'select user_id, papel from public.marketing_member where workspace_id = $1',
    [workspaceIdA],
  );
  assert.deepEqual(
    membrosIniciais.rows,
    [{ user_id: usuarioA, papel: 'ADMINISTRADOR' }],
    'O workspace não iniciou com exatamente um administrador.',
  );

  const ideia = await db.query(
    'select * from public.marketing_criar_briefing($1, $2)',
    [workspaceIdA, 'Ideia inicial'],
  );
  assert.equal(ideia.rows[0].status, 'IDEIA');

  await esperaErro(
    'Preparar estratégia deve exigir o briefing completo',
    () => db.query(
      `select * from public.marketing_criar_briefing(
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )`,
      [workspaceIdA, 'Briefing incompleto', '', '', '', 'CARROSSEL', null, '', true],
    ),
    '23514',
  );

  await esperaErro(
    'O cliente autenticado não deve adicionar membros diretamente',
    () => db.query(
      `insert into public.marketing_member (workspace_id, user_id, papel)
       values ($1, $2, 'REVISOR')`,
      [workspaceIdA, usuarioC],
    ),
    '42501',
  );

  const briefing = await db.query(
    `select * from public.marketing_criar_briefing(
      $1, $2, $3, $4, $5, $6, $7, $8, $9
    )`,
    [workspaceIdA, 'Campanha de primavera', 'Gerar demanda', '', '', 'CARROSSEL', null, '', false],
  );
  const briefingId = briefing.rows[0].id;
  assert.equal(briefing.rows[0].status, 'EM_BRIEFING');
  assert.equal(briefing.rows[0].versao, 1);

  const briefingPronto = await db.query(
    `select * from public.marketing_atualizar_briefing(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    )`,
    [
      workspaceIdA, briefingId, 1, 'Campanha de primavera', 'Gerar demanda',
      'Gestores de pequenos negócios', 'Educação', 'CARROSSEL', '2026-10-01',
      'Conteúdo educativo aumenta intenção', true,
    ],
  );
  assert.equal(briefingPronto.rows[0].status, 'PRONTO_PARA_ESTRATEGIA');
  assert.equal(briefingPronto.rows[0].versao, 2);

  await esperaErro(
    'Uma edição com versão vencida deve ser rejeitada',
    () => db.query(
      `select * from public.marketing_atualizar_briefing(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )`,
      [
        workspaceIdA, briefingId, 1, 'Versão antiga', '', '', '', 'CARROSSEL',
        null, '', false,
      ],
    ),
    '40001',
  );

  await esperaErro(
    'O cliente autenticado não deve gravar conteúdo diretamente',
    () => db.query(
      `insert into public.marketing_content_item
        (workspace_id, criado_por, titulo, formato)
       values ($1, $2, 'Inserção direta', 'FEED')`,
      [workspaceIdA, usuarioA],
    ),
    '42501',
  );

  await esperaErro(
    'O último administrador não pode remover a si mesmo',
    () => db.query(
      'select * from public.marketing_remover_membro($1, $2)',
      [workspaceIdA, usuarioA],
    ),
    '23514',
  );

  const revisor = await db.query(
    "select * from public.marketing_adicionar_membro($1, $2, 'REVISOR')",
    [workspaceIdA, usuarioC],
  );
  assert.equal(revisor.rows[0].papel, 'REVISOR');

  await como(db, 'authenticated', usuarioC);
  await esperaErro(
    'Um revisor não deve adicionar membros',
    () => db.query(
      "select * from public.marketing_adicionar_membro($1, $2, 'REVISOR')",
      [workspaceIdA, usuarioB],
    ),
    '42501',
  );

  await db.exec('reset role;');
  await como(db, 'authenticated', usuarioB);
  const workspaceB = await db.query(
    'select * from public.marketing_criar_workspace($1, $2)',
    ['Outro workspace', workspaceKeyB],
  );
  const workspaceIdB = workspaceB.rows[0].id;

  const workspacesVisiveis = await db.query('select id from public.marketing_workspace order by id');
  assert.deepEqual(
    workspacesVisiveis.rows.map((row) => row.id),
    [workspaceIdB],
    'A RLS permitiu leitura de outro workspace.',
  );

  await esperaErro(
    'Um não membro não deve criar briefing em outro workspace',
    () => db.query(
      'select * from public.marketing_criar_briefing($1, $2)',
      [workspaceIdA, 'Acesso cruzado'],
    ),
    '42501',
  );
  await esperaErro(
    'Um não membro não deve renomear outro workspace',
    () => db.query(
      'select * from public.marketing_atualizar_workspace_nome($1, $2)',
      [workspaceIdA, 'Nome indevido'],
    ),
    '42501',
  );

  await como(db, 'anon', '');
  await esperaErro(
    'O papel anônimo não deve ler workspaces',
    () => db.query('select id from public.marketing_workspace'),
    '42501',
  );

  await como(db, 'authenticated', '');
  await esperaErro(
    'Uma sessão sem usuário não deve criar workspace',
    () => db.query(
      'select * from public.marketing_criar_workspace($1, $2)',
      ['Sem autenticação', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
    ),
    '42501',
  );

  await db.exec('reset role;');
  await como(db, 'service_role', usuarioA);
  const aiRunId = '44444444-4444-4444-8444-444444444444';
  const aiRunKey = '55555555-5555-4555-8555-555555555555';
  await db.query(
    `insert into public.marketing_ai_run (
      id, workspace_id, content_item_id, solicitado_por, operacao,
      provedor, modelo, limite_tokens, idempotency_key
    ) values ($1, $2, $3, $4, 'ESTRATEGIA', 'teste', 'modelo-teste', 1000, $5)`,
    [aiRunId, workspaceIdA, briefingId, usuarioA, aiRunKey],
  );

  await esperaErro(
    'Uma execução de IA não deve repetir a chave idempotente no workspace',
    () => db.query(
      `insert into public.marketing_ai_run (
        workspace_id, content_item_id, solicitado_por, operacao,
        provedor, modelo, limite_tokens, idempotency_key
      ) values ($1, $2, $3, 'ESTRATEGIA', 'teste', 'modelo-teste', 1000, $4)`,
      [workspaceIdA, briefingId, usuarioA, aiRunKey],
    ),
    '23505',
  );
  await esperaErro(
    'Um estado final de IA deve exigir data de conclusão',
    () => db.query(
      "update public.marketing_ai_run set status = 'CONCLUIDO' where id = $1",
      [aiRunId],
    ),
    '23514',
  );
  await db.query(
    `update public.marketing_ai_run
        set status = 'CONCLUIDO', concluido_em = now(),
            tokens_entrada = 100, tokens_saida = 50, custo_real = 0.008
      where id = $1`,
    [aiRunId],
  );
  await esperaErro(
    'Custos negativos de IA devem ser rejeitados',
    () => db.query(
      `insert into public.marketing_ai_run (
        workspace_id, content_item_id, solicitado_por, operacao,
        provedor, modelo, limite_tokens, idempotency_key, custo_estimado
      ) values ($1, $2, $3, 'LEGENDA', 'teste', 'modelo-teste', 1000, $4, -0.01)`,
      [workspaceIdA, briefingId, usuarioA, '66666666-6666-4666-8666-666666666666'],
    ),
    '23514',
  );

  const ledgerId = '77777777-7777-4777-8777-777777777777';
  await db.query(
    `insert into public.marketing_cost_ledger (
      id, workspace_id, ai_run_id, tipo, idempotency_key,
      operacao, modelo, custo_estimado
    ) values ($1, $2, $3, 'RESERVA', $4, 'ESTRATEGIA', 'modelo-teste', 0.01)`,
    [ledgerId, workspaceIdA, aiRunId, '88888888-8888-4888-8888-888888888888'],
  );
  await esperaErro(
    'Custos negativos no ledger devem ser rejeitados',
    () => db.query(
      `insert into public.marketing_cost_ledger (
        workspace_id, ai_run_id, tipo, idempotency_key,
        operacao, modelo, custo_real
      ) values ($1, $2, 'CONSUMO', $3, 'ESTRATEGIA', 'modelo-teste', -0.01)`,
      [workspaceIdA, aiRunId, '99999999-9999-4999-8999-999999999999'],
    ),
    '23514',
  );
  await esperaErro(
    'Um estorno deve referenciar o lançamento revertido',
    () => db.query(
      `insert into public.marketing_cost_ledger (
        workspace_id, ai_run_id, tipo, idempotency_key,
        operacao, modelo, custo_real
      ) values ($1, $2, 'ESTORNO', $3, 'ESTRATEGIA', 'modelo-teste', 0.01)`,
      [workspaceIdA, aiRunId, 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'],
    ),
    '23514',
  );
  await esperaErro(
    'O ledger não pode apontar para execução de outro workspace',
    () => db.query(
      `insert into public.marketing_cost_ledger (
        workspace_id, ai_run_id, tipo, idempotency_key,
        operacao, modelo, custo_real
      ) values ($1, $2, 'CONSUMO', $3, 'ESTRATEGIA', 'modelo-teste', 0.01)`,
      [workspaceIdB, aiRunId, 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'],
    ),
    '23503',
  );

  const estornoId = 'cccccccc-1111-4111-8111-cccccccccccc';
  await db.query(
    `insert into public.marketing_cost_ledger (
      id, workspace_id, ai_run_id, tipo, idempotency_key, reverte_ledger_id,
      operacao, modelo, custo_real
    ) values ($1, $2, $3, 'ESTORNO', $4, $5, 'ESTRATEGIA', 'modelo-teste', 0.01)`,
    [
      estornoId, workspaceIdA, aiRunId,
      'dddddddd-1111-4111-8111-dddddddddddd', ledgerId,
    ],
  );
  await esperaErro(
    'Um lançamento do ledger só pode ser estornado uma vez',
    () => db.query(
      `insert into public.marketing_cost_ledger (
        workspace_id, ai_run_id, tipo, idempotency_key, reverte_ledger_id,
        operacao, modelo, custo_real
      ) values ($1, $2, 'ESTORNO', $3, $4, 'ESTRATEGIA', 'modelo-teste', 0.01)`,
      [workspaceIdA, aiRunId, 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee', ledgerId],
    ),
    '23505',
  );
  await esperaErro(
    'O papel de servidor não deve receber UPDATE no ledger',
    () => db.query(
      'update public.marketing_cost_ledger set custo_estimado = 0.02 where id = $1',
      [ledgerId],
    ),
    '42501',
  );

  await db.exec('reset role;');
  await esperaErro(
    'O ledger deve permanecer append-only',
    () => db.query(
      'update public.marketing_cost_ledger set custo_estimado = 0.02 where id = $1',
      [ledgerId],
    ),
    '55000',
  );
  await esperaErro(
    'O ledger append-only não deve permitir exclusão pelo proprietário',
    () => db.query(
      'delete from public.marketing_cost_ledger where id = $1',
      [ledgerId],
    ),
    '55000',
  );

  await esperaErro(
    'A identidade de um conteúdo deve ser imutável',
    () => db.query(
      'update public.marketing_content_item set workspace_id = $1 where id = $2',
      [workspaceIdB, briefingId],
    ),
    '23514',
  );

  await como(db, 'service_role', usuarioA);
  await esperaErro(
    'Uma execução de IA não pode apontar para conteúdo de outro workspace',
    () => db.query(
      `insert into public.marketing_ai_run (
        workspace_id, content_item_id, solicitado_por, operacao,
        provedor, modelo, limite_tokens, idempotency_key
      ) values ($1, $2, $3, 'ESTRATEGIA', 'teste', 'modelo-teste', 1000, $4)`,
      [workspaceIdB, briefingId, usuarioB, '77777777-7777-4777-8777-777777777777'],
    ),
    '23503',
  );

  await como(db, 'service_role', '');
  const execucaoBloqueada = await db.query(
    `select * from public.marketing_iniciar_execucao_ia(
      $1, $2, $3, 'ESTRATEGIA', 'openrouter', 'modelo-teste', 1000, $4, 0.01
    )`,
    [
      workspaceIdA, briefingId, usuarioA,
      '12121212-1212-4121-8121-121212121212',
    ],
  );
  assert.equal(
    execucaoBloqueada.rows[0].status,
    'BLOQUEADO',
    'A IA precisa iniciar bloqueada sem orçamento configurado.',
  );
  assert.equal(
    execucaoBloqueada.rows[0].erro_codigo,
    'ORCAMENTO_NAO_CONFIGURADO',
    'O bloqueio sem orçamento precisa ser explicável.',
  );

  await como(db, 'authenticated', usuarioA);
  const budget = await db.query(
    'select * from public.marketing_configurar_orcamento_ia($1, $2, $3)',
    [workspaceIdA, 1, 0.1],
  );
  assert.equal(Number(budget.rows[0].limite_mensal_usd), 1, 'Administrador não configurou o orçamento mensal.');
  await esperaErro(
    'Cliente autenticado não pode iniciar execução interna de IA',
    () => db.query(
      `select * from public.marketing_iniciar_execucao_ia(
        $1, $2, $3, 'ESTRATEGIA', 'openrouter', 'modelo-teste', 1000, $4, 0.01
      )`,
      [workspaceIdA, briefingId, usuarioA, '13131313-1313-4131-8131-131313131313'],
    ),
    '42501',
  );

  await como(db, 'service_role', '');
  const execucaoIniciada = await db.query(
    `select * from public.marketing_iniciar_execucao_ia(
      $1, $2, $3, 'ESTRATEGIA', 'openrouter', 'modelo-teste', 1000, $4, 0.01
    )`,
    [workspaceIdA, briefingId, usuarioA, '14141414-1414-4141-8141-141414141414'],
  );
  const aiRunProtegida = execucaoIniciada.rows[0];
  assert.equal(aiRunProtegida.status, 'EXECUTANDO', 'A reserva dentro do teto não iniciou a execução.');

  const versaoIa = await db.query(
    `select * from public.marketing_finalizar_execucao_ia($1, $2::jsonb, $3, $4, $5)`,
    [
      aiRunProtegida.id,
      JSON.stringify({
        estrategia: 'Ensinar iniciantes com um carrossel de checklist.',
        angulo: 'Evite os três erros mais comuns.',
        legenda: 'Comece pelo básico e salve para revisar.',
        cta: 'Qual desses erros você já cometeu?',
      }),
      120,
      80,
      0.005,
    ],
  );
  assert.equal(versaoIa.rows[0].origem, 'IA', 'A versão produzida não registrou sua origem.');
  assert.equal(versaoIa.rows[0].numero, 1, 'A primeira versão de IA precisa iniciar em 1.');

  const execucaoConcluida = await db.query(
    'select status, custo_real, resposta from public.marketing_ai_run where id = $1',
    [aiRunProtegida.id],
  );
  assert.equal(execucaoConcluida.rows[0].status, 'CONCLUIDO', 'A execução de IA não foi concluída.');
  assert.equal(Number(execucaoConcluida.rows[0].custo_real), 0.005, 'O custo real não foi registrado.');
  const lancamentosIa = await db.query(
    'select tipo from public.marketing_cost_ledger where ai_run_id = $1 order by criado_em',
    [aiRunProtegida.id],
  );
  assert.deepEqual(
    lancamentosIa.rows.map((linha) => linha.tipo).sort(),
    ['CONSUMO', 'ESTORNO', 'RESERVA'],
    'A conclusão deve consumir o custo real e estornar a reserva.',
  );

  await como(db, 'authenticated', usuarioA);
  const versoesVisiveis = await db.query(
    'select * from public.marketing_content_version where content_item_id = $1',
    [briefingId],
  );
  assert.equal(versoesVisiveis.rows.length, 1, 'O membro não conseguiu ler sua versão de conteúdo.');
  await esperaErro(
    'Cliente autenticado não grava versões diretamente',
    () => db.query(
      `insert into public.marketing_content_version (
        workspace_id, content_item_id, numero, operacao, origem, conteudo, criado_por
      ) values ($1, $2, 2, 'ESTRATEGIA', 'HUMANO', '{}'::jsonb, $3)`,
      [workspaceIdA, briefingId, usuarioA],
    ),
    '42501',
  );

  await db.exec('reset role;');
  const auditoria = await db.query(`
    select entidade, evento
      from public.marketing_audit_event
     where workspace_id = $1
  `, [workspaceIdA]);
  assert.ok(auditoria.rows.length >= 6, 'A auditoria automática não registrou as mutações esperadas.');
  assert.ok(
    auditoria.rows.some((row) => row.entidade === 'marketing_cost_ledger' && row.evento === 'INSERT'),
    'O lançamento de custo não foi auditado.',
  );

  const auditId = await db.query(
    'select id from public.marketing_audit_event where workspace_id = $1 limit 1',
    [workspaceIdA],
  );
  await esperaErro(
    'A auditoria append-only não deve permitir alteração pelo proprietário',
    () => db.query(
      "update public.marketing_audit_event set origem = 'SISTEMA' where id = $1",
      [auditId.rows[0].id],
    ),
    '55000',
  );
  await esperaErro(
    'A auditoria append-only não deve permitir exclusão pelo proprietário',
    () => db.query(
      'delete from public.marketing_audit_event where id = $1',
      [auditId.rows[0].id],
    ),
    '55000',
  );
  await esperaErro(
    'Metadados de auditoria acima de 32 KiB devem ser rejeitados',
    () => db.query(
      `insert into public.marketing_audit_event (
        workspace_id, entidade, entidade_id, evento, origem, metadados
      ) values ($1, 'marketing_workspace', $1, 'INSERT', 'SISTEMA', $2::jsonb)`,
      [workspaceIdA, JSON.stringify({ payload: 'x'.repeat(33_000) })],
    ),
    '23514',
  );
  await esperaErro(
    'Um workspace com histórico não deve ser removido fisicamente',
    () => db.query('delete from public.marketing_workspace where id = $1', [workspaceIdA]),
    '23514',
  );

  await como(db, 'service_role', '');
  const livreBloqueado = await db.query(
    `select * from public.marketing_iniciar_execucao_ia_livre(
      $1, $2, 'CLASSIFICAR_COMENTARIO', 'openrouter', 'modelo-teste', 800, $3, 0.001
    )`,
    [workspaceIdB, usuarioB, '15151515-1515-4151-8151-151515151515'],
  );
  assert.equal(
    livreBloqueado.rows[0].status,
    'BLOQUEADO',
    'A execução livre precisa iniciar bloqueada sem orçamento configurado.',
  );
  assert.equal(
    livreBloqueado.rows[0].content_item_id,
    null,
    'A execução livre não deveria referenciar um content_item.',
  );

  const livreIniciada = await db.query(
    `select * from public.marketing_iniciar_execucao_ia_livre(
      $1, $2, 'CLASSIFICAR_COMENTARIO', 'openrouter', 'modelo-teste', 800, $3, 0.01
    )`,
    [workspaceIdA, usuarioA, '16161616-1616-4161-8161-161616161616'],
  );
  assert.equal(livreIniciada.rows[0].status, 'EXECUTANDO', 'A execução livre dentro do teto não iniciou.');

  const livreFinalizada = await db.query(
    'select * from public.marketing_finalizar_execucao_ia_livre($1, $2::jsonb, $3, $4, $5)',
    [livreIniciada.rows[0].id, JSON.stringify({ classificados: 3 }), 200, 50, 0.004],
  );
  assert.equal(livreFinalizada.rows[0].status, 'CONCLUIDO', 'A execução livre não foi concluída.');

  const versoesAposLivre = await db.query(
    'select count(*)::integer as total from public.marketing_content_version where ai_run_id = $1',
    [livreIniciada.rows[0].id],
  );
  assert.equal(
    versoesAposLivre.rows[0].total,
    0,
    'A execução livre não deveria criar marketing_content_version.',
  );

  await db.exec('reset role;');
  await como(db, 'authenticated', usuarioA);

  // Regressão do bug real 2026-09-15: a CASE atribuída a `status` sem cast para o enum
  // marketing_content_status fazia TODA decisão de aprovação falhar com 42804 em produção.
  const solicitacao = await db.query(
    'select * from public.marketing_solicitar_aprovacao_conteudo($1, $2, $3, $4)',
    [workspaceIdA, briefingId, versaoIa.rows[0].id, ''],
  );
  const aprovacaoId = solicitacao.rows[0].id;

  const decisaoAprovada = await db.query(
    'select * from public.marketing_decidir_aprovacao_conteudo($1, $2, true, $3)',
    [workspaceIdA, aprovacaoId, ''],
  );
  assert.equal(decisaoAprovada.rows[0].decisao, 'APROVADO', 'A aprovação não foi registrada.');

  const itemAprovado = await db.query(
    'select status from public.marketing_content_item where id = $1',
    [briefingId],
  );
  assert.equal(
    itemAprovado.rows[0].status,
    'APROVADO',
    'O briefing deveria virar APROVADO depois da decisão — este é o bug real de 2026-09-15 (42804 sem cast de enum).',
  );

  const notaChave = 'dededede-dede-4ded-8ded-dededededede';
  const nota = await db.query(
    `select * from public.marketing_criar_nota_contexto($1, $2, $3, 'EVENTO', $4, $5)`,
    [workspaceIdA, notaChave, 'Nota original', '2026-09-01', 'Texto original da nota'],
  );
  const notaId = nota.rows[0].id;

  const notaEditada = await db.query(
    `select * from public.marketing_editar_nota_contexto($1, $2, $3, 'CAMPANHA', $4, $5)`,
    [workspaceIdA, notaId, 'Nota editada', '2026-09-02', 'Texto editado da nota'],
  );
  assert.equal(notaEditada.rows[0].titulo, 'Nota editada', 'A edição da nota não foi aplicada.');
  assert.ok(notaEditada.rows[0].editado_em, 'A edição deveria marcar editado_em.');

  const notaArquivada = await db.query(
    'select * from public.marketing_arquivar_nota_contexto($1, $2)',
    [workspaceIdA, notaId],
  );
  assert.ok(notaArquivada.rows[0].arquivado_em, 'O arquivamento deveria marcar arquivado_em.');

  await esperaErro(
    'Uma nota já arquivada não deve ser editável de novo',
    () => db.query(
      `select * from public.marketing_editar_nota_contexto($1, $2, $3, 'EVENTO', $4, $5)`,
      [workspaceIdA, notaId, 'Tentativa após arquivar', '2026-09-03', 'Não deveria funcionar'],
    ),
    'P0002',
  );

  await db.exec('reset role;');
  const auditoriaNota = await db.query(
    `select evento from public.marketing_audit_event
      where workspace_id = $1 and entidade = 'marketing_context_note' and entidade_id = $2
      order by criado_em`,
    [workspaceIdA, notaId],
  );
  assert.deepEqual(
    auditoriaNota.rows.map((r) => r.evento),
    ['INSERT', 'UPDATE', 'UPDATE'],
    'A edição e o arquivamento da nota deveriam ficar auditados, preservando o registro original.',
  );

  await db.exec('reset role;');
  await como(db, 'service_role', '');
  // Regressão do bug real 2026-09-15: entrada_resumida com volume realista (~150 posts,
  // como uma conta de verdade acumula) — o gatilho de auditoria genérico duplicava isso
  // em antes+depois e estourava o limite de 32KB de marketing_audit_event em todo UPDATE.
  const entradaResumidaGrande = JSON.stringify({
    periodo_inicio: '2026-09-01', periodo_fim: '2026-09-07', publicacoes: 150,
    metricas_agregadas: Array.from({ length: 150 }, (_, i) => ({
      data_publicacao: '2026-09-01', link: `https://instagram.com/p/teste${i}`,
      tipo: 'IMAGE', likes: i, comentarios: i,
    })),
  });
  const insight = await db.query(
    `insert into public.marketing_insight (
      workspace_id, ai_run_id, periodo_inicio, periodo_fim, entrada_resumida,
      hipotese, evidencias, limitacoes, confianca, proxima_acao, custo_usd, modelo_ia
    ) values ($1, $2, '2026-09-01', '2026-09-07', $3::jsonb, 'Hipótese de teste', '[]'::jsonb, '', 'BAIXA', '', 0.01, 'modelo-teste')
    returning *`,
    [workspaceIdA, livreIniciada.rows[0].id, entradaResumidaGrande],
  );
  const insightId = insight.rows[0].id;
  assert.equal(insight.rows[0].decisao, 'PENDENTE', 'A hipótese deveria nascer pendente.');

  await db.exec('reset role;');
  await como(db, 'authenticated', usuarioA);
  const insightAprovado = await db.query(
    'select * from public.marketing_decidir_insight($1, $2, true)',
    [workspaceIdA, insightId],
  );
  assert.equal(insightAprovado.rows[0].decisao, 'APROVADO', 'A aprovação da hipótese não foi registrada.');
  assert.equal(insightAprovado.rows[0].decidido_por, usuarioA, 'A hipótese aprovada deveria registrar quem decidiu.');

  await esperaErro(
    'Uma hipótese já decidida não pode ser decidida de novo',
    () => db.query('select * from public.marketing_decidir_insight($1, $2, false)', [workspaceIdA, insightId]),
    '55000',
  );

  await db.exec('reset role;');
  await como(db, 'authenticated', usuarioC);
  await esperaErro(
    'Um revisor não deve decidir hipóteses — só administrador',
    () => db.query('select * from public.marketing_decidir_insight($1, $2, true)', [workspaceIdA, insightId]),
    '42501',
  );

  await db.exec('reset role;');
  await como(db, 'service_role', '');
  const objetoImagem = await db.query(
    `insert into storage.objects (bucket_id, name) values ('marketing-imagens', $1) returning id`,
    [`${workspaceIdA}/${livreIniciada.rows[0].id}-teste.png`],
  );
  await db.query(
    `insert into public.marketing_image_asset (
      workspace_id, content_item_id, content_version_id, ai_run_id, prompt_aprovado, modelo_ia, storage_path, gerado_por
    ) values ($1, $2, $3, $4, 'prompt de teste', 'modelo-teste', $5, $6)`,
    [
      workspaceIdA, briefingId, versaoIa.rows[0].id, livreIniciada.rows[0].id,
      `${workspaceIdA}/${livreIniciada.rows[0].id}-teste.png`, usuarioA,
    ],
  );

  await db.exec('reset role;');
  await como(db, 'authenticated', usuarioA);
  const objetosVisiveisMembro = await db.query('select id from storage.objects');
  assert.equal(objetosVisiveisMembro.rows.length, 1, 'Um membro do workspace deveria ver o objeto da imagem.');

  await db.exec('reset role;');
  await como(db, 'authenticated', usuarioB);
  const objetosVisiveisNaoMembro = await db.query('select id from storage.objects');
  assert.equal(objetosVisiveisNaoMembro.rows.length, 0, 'Um usuário fora do workspace não deveria ver o objeto da imagem.');
  void objetoImagem;

  // ---------------------------------------------------------------------------
  // Onda 1 do spec-kit atol-analise-instagram-avancada: dimensão de mídia e leitura
  // sem dupla contagem (marketing_instagram_ultimo_snapshot/delta_snapshot).
  // ---------------------------------------------------------------------------
  await db.exec('reset role;');
  const igAccountId = 'f0f0f0f0-1111-4111-8111-f0f0f0f0f0f0';
  await db.query(
    "insert into public.ig_account (id, user_id, username) values ($1, $2, 'atol.ia.oficial')",
    [igAccountId, usuarioA],
  );
  await como(db, 'authenticated', usuarioA);
  const conexaoInstagram = await db.query(
    'select * from public.marketing_vincular_conta_instagram($1, $2)',
    [workspaceIdA, igAccountId],
  );
  const connectionId = conexaoInstagram.rows[0].id;

  await db.exec('reset role;');
  await como(db, 'service_role', '');

  const mediaRecenteId = 'ig-post-recente';
  const publicadoRecente = new Date(Date.now() - 2 * 86400000).toISOString();
  const mediaAntigaId = 'ig-post-antigo';
  const publicadoAntigo = new Date(Date.now() - 90 * 86400000).toISOString();

  await db.query(
    `insert into public.marketing_instagram_media
       (workspace_id, connection_id, ig_media_id, media_type, permalink, publicado_em)
     values
       ($1, $2, $3, 'IMAGE', 'https://instagram.com/p/recente', $4),
       ($1, $2, $5, 'IMAGE', 'https://instagram.com/p/antigo', $6)`,
    [workspaceIdA, connectionId, mediaRecenteId, publicadoRecente, mediaAntigaId, publicadoAntigo],
  );

  await esperaErro(
    'Um snapshot não pode referenciar mídia sem dimensão correspondente',
    () => db.query(
      `insert into public.marketing_instagram_metric_snapshot
         (workspace_id, connection_id, ig_media_id, media_type, permalink, publicado_em, metricas)
       values ($1, $2, 'ig-post-inexistente', 'IMAGE', null, null, '{}'::jsonb)`,
      [workspaceIdA, connectionId],
    ),
    '23503',
  );

  // Regressão do bug real: reimportar o mesmo post grava uma linha nova (coletado_em
  // diferente) em vez de atualizar. O código antigo somava todas as linhas do
  // período — duas "importações" do post recente, 100 e depois 120 curtidas.
  const coletaUm = new Date(Date.now() - 3 * 3600000).toISOString();
  const coletaDois = new Date().toISOString();
  await db.query(
    `insert into public.marketing_instagram_metric_snapshot
       (workspace_id, connection_id, ig_media_id, media_type, permalink, publicado_em, metricas, coletado_em)
     values
       ($1, $2, $3, 'IMAGE', 'https://instagram.com/p/recente', $4, $5::jsonb, $6),
       ($1, $2, $3, 'IMAGE', 'https://instagram.com/p/recente', $4, $7::jsonb, $8)`,
    [
      workspaceIdA, connectionId, mediaRecenteId, publicadoRecente,
      JSON.stringify({ likes: 100, comentarios: 10 }), coletaUm,
      JSON.stringify({ likes: 120, comentarios: 12 }), coletaDois,
    ],
  );
  // Post antigo: uma única observação, coletada agora (reimportação tardia de conteúdo velho).
  await db.query(
    `insert into public.marketing_instagram_metric_snapshot
       (workspace_id, connection_id, ig_media_id, media_type, permalink, publicado_em, metricas, coletado_em)
     values ($1, $2, $3, 'IMAGE', 'https://instagram.com/p/antigo', $4, $5::jsonb, $6)`,
    [workspaceIdA, connectionId, mediaAntigaId, publicadoAntigo, JSON.stringify({ likes: 5, comentarios: 1 }), new Date().toISOString()],
  );

  await db.exec('reset role;');
  await como(db, 'authenticated', usuarioA);

  const ultimoTodas = await db.query(
    'select * from public.marketing_instagram_ultimo_snapshot($1)',
    [workspaceIdA],
  );
  assert.equal(
    ultimoTodas.rows.filter((r) => r.ig_media_id === mediaRecenteId).length, 1,
    'Reimportar o mesmo post deveria produzir uma única linha na leitura, não uma por importação.',
  );
  const linhaRecente = ultimoTodas.rows.find((r) => r.ig_media_id === mediaRecenteId);
  assert.equal(
    Number(paraObjeto(linhaRecente.metricas).likes), 120,
    'A leitura deveria trazer o último valor observado (120), nunca a soma das reimportações (220).',
  );

  const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString();
  const ultimoDaSemana = await db.query(
    'select * from public.marketing_instagram_ultimo_snapshot($1, now(), $2)',
    [workspaceIdA, seteDiasAtras],
  );
  assert.deepEqual(
    ultimoDaSemana.rows.map((r) => r.ig_media_id).sort(),
    [mediaRecenteId],
    'O post publicado há 90 dias não deveria entrar no período semanal só por ter sido coletado agora (AC-02).',
  );

  const delta = await db.query(
    'select * from public.marketing_instagram_delta_snapshot($1, $2)',
    [workspaceIdA, coletaUm],
  );
  const deltaRecente = delta.rows.find((r) => r.ig_media_id === mediaRecenteId);
  assert.equal(Number(paraObjeto(deltaRecente.metricas_antes).likes), 100, 'O delta não capturou o valor "antes" correto.');
  assert.equal(Number(paraObjeto(deltaRecente.metricas_depois).likes), 120, 'O delta não capturou o valor "depois" correto.');

  const deltaSemHistorico = await db.query(
    'select * from public.marketing_instagram_delta_snapshot($1, $2)',
    [workspaceIdA, new Date(Date.now() - 365 * 86400000).toISOString()],
  );
  const deltaAntiga = deltaSemHistorico.rows.find((r) => r.ig_media_id === mediaAntigaId);
  assert.equal(
    deltaAntiga.metricas_antes, null,
    'Uma mídia sem observação anterior à janela deveria vir com metricas_antes nula, nunca zero.',
  );

  await db.exec('reset role;');
  await como(db, 'anon', '');
  await esperaErro(
    'O papel anônimo não deve ler a dimensão de mídia',
    () => db.query('select * from public.marketing_instagram_media'),
    '42501',
  );

  console.log('Onda 1 (atol-analise-instagram-avancada): dedup e coorte por publicado_em verificados no PostgreSQL descartável.');

  // ---------------------------------------------------------------------------
  // Onda 2 do spec-kit atol-analise-instagram-avancada: série diária de conta —
  // upsert por dia, nunca acumula várias linhas para a mesma data (mesma classe de
  // bug corrigida na 0030, evitada aqui desde o desenho da tabela).
  // ---------------------------------------------------------------------------
  await db.exec('reset role;');
  const hoje = new Date().toISOString().slice(0, 10);
  await db.query(
    `insert into public.marketing_instagram_account_metric_daily
       (workspace_id, connection_id, data, seguidores, metricas)
     values ($1, $2, $3, 120, $4::jsonb)`,
    [workspaceIdA, connectionId, hoje, JSON.stringify({ reach: 300, views: 500 })],
  );
  await db.query(
    `insert into public.marketing_instagram_account_metric_daily
       (workspace_id, connection_id, data, seguidores, metricas)
     values ($1, $2, $3, 125, $4::jsonb)
     on conflict (workspace_id, data) do update set
       seguidores = excluded.seguidores, metricas = excluded.metricas, atualizado_em = now()`,
    [workspaceIdA, connectionId, hoje, JSON.stringify({ reach: 340, views: 560 })],
  );
  const contaHoje = await db.query(
    'select seguidores, metricas from public.marketing_instagram_account_metric_daily where workspace_id = $1 and data = $2',
    [workspaceIdA, hoje],
  );
  assert.equal(contaHoje.rows.length, 1, 'Duas coletas no mesmo dia deveriam upsertar uma única linha, não acumular.');
  assert.equal(contaHoje.rows[0].seguidores, 125, 'O upsert deveria refletir a coleta mais recente do dia.');
  assert.equal(Number(paraObjeto(contaHoje.rows[0].metricas).reach), 340, 'O upsert deveria refletir as métricas mais recentes do dia.');

  await como(db, 'anon', '');
  await esperaErro(
    'O papel anônimo não deve ler a série diária de conta',
    () => db.query('select * from public.marketing_instagram_account_metric_daily'),
    '42501',
  );
  await db.exec('reset role;');

  console.log('Onda 2 (atol-analise-instagram-avancada): upsert diário de métricas de conta verificado no PostgreSQL descartável.');

  // ---------------------------------------------------------------------------
  // Onda 5 do spec-kit atol-analise-instagram-avancada: análise de IA por post,
  // versionada e append-only — nunca reprocessada sozinha, só cria numero+1.
  // ---------------------------------------------------------------------------
  await db.exec('reset role;');
  await como(db, 'service_role', '');
  const analiseV1 = await db.query(
    `insert into public.marketing_instagram_post_analysis
       (workspace_id, ig_media_id, numero, analise, sugestao, modelo_ia, solicitado_por, origem)
     values ($1, $2, 1, 'Análise automática de exemplo.', 'Sugestão de exemplo.', 'modelo-teste', $3, 'AUTOMATICA')
     returning id`,
    [workspaceIdA, mediaRecenteId, usuarioA],
  );
  await esperaErro(
    'Uma análise não pode repetir o mesmo número de versão para o mesmo post',
    () => db.query(
      `insert into public.marketing_instagram_post_analysis
         (workspace_id, ig_media_id, numero, analise, modelo_ia, solicitado_por, origem)
       values ($1, $2, 1, 'Duplicada.', 'modelo-teste', $3, 'MANUAL')`,
      [workspaceIdA, mediaRecenteId, usuarioA],
    ),
    '23505',
  );
  const analiseV2 = await db.query(
    `insert into public.marketing_instagram_post_analysis
       (workspace_id, ig_media_id, numero, analise, sugestao, modelo_ia, solicitado_por, origem)
     values ($1, $2, 2, 'Reanálise manual de exemplo.', 'Nova sugestão.', 'modelo-teste', $3, 'MANUAL')
     returning id`,
    [workspaceIdA, mediaRecenteId, usuarioA],
  );
  const versoesAnalise = await db.query(
    'select numero from public.marketing_instagram_post_analysis where workspace_id = $1 and ig_media_id = $2 order by numero',
    [workspaceIdA, mediaRecenteId],
  );
  assert.deepEqual(
    versoesAnalise.rows.map((r) => r.numero), [1, 2],
    'A reanálise deveria criar a versão 2 preservando a versão 1, nunca sobrescrever.',
  );
  await esperaErro(
    'Uma análise não pode referenciar mídia sem dimensão correspondente',
    () => db.query(
      `insert into public.marketing_instagram_post_analysis
         (workspace_id, ig_media_id, numero, analise, modelo_ia, solicitado_por, origem)
       values ($1, 'ig-post-inexistente', 1, 'Análise.', 'modelo-teste', $2, 'AUTOMATICA')`,
      [workspaceIdA, usuarioA],
    ),
    '23503',
  );

  await db.exec('reset role;');
  await esperaErro(
    'A análise de post deve permanecer append-only (update)',
    () => db.query(
      "update public.marketing_instagram_post_analysis set analise = 'Alterada' where id = $1",
      [analiseV1.rows[0].id],
    ),
    '55000',
  );
  await esperaErro(
    'A análise de post deve permanecer append-only (delete)',
    () => db.query('delete from public.marketing_instagram_post_analysis where id = $1', [analiseV2.rows[0].id]),
    '55000',
  );

  await como(db, 'anon', '');
  await esperaErro(
    'O papel anônimo não deve ler análises de post',
    () => db.query('select * from public.marketing_instagram_post_analysis'),
    '42501',
  );
  await db.exec('reset role;');

  console.log('Onda 5 (atol-analise-instagram-avancada): versionamento append-only da análise de post verificado no PostgreSQL descartável.');

  console.log('Migrações 0013–0020: execução real e invariantes críticas verificadas no PostgreSQL descartável.');
} finally {
  await db.close();
}

const rollbackDb = new PGlite();
try {
  await prepararSupabaseDescartavel(rollbackDb);
  const migracaoComFalha = sql.replace(
    /commit;\s*$/i,
    'select * from public.__falha_intencional_de_validacao;\ncommit;',
  );
  await esperaErro(
    'Uma falha deve desfazer a migração inteira',
    () => rollbackDb.exec(migracaoComFalha),
    '42P01',
  );
  await rollbackDb.exec('rollback;');
  const objetosParciais = await rollbackDb.query(`
    select count(*)::integer as total
      from pg_catalog.pg_class as c
      join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = any($1::text[])
  `, [tabelasRls]);
  assert.equal(objetosParciais.rows[0].total, 0, 'A falha deixou objetos parciais no banco.');
  console.log('Migração 0013: rollback transacional verificado sem objetos parciais.');
} finally {
  await rollbackDb.close();
}

// Migração 0030, risco #3 do spec-kit: o backfill precisa preservar dado que já
// existia ANTES desta migração — aplica 0013–0029, semeia snapshots como se fossem
// reimportações antigas, só então aplica 0030 e confere o resultado.
const backfillDb = new PGlite();
try {
  await prepararSupabaseDescartavel(backfillDb);
  await backfillDb.exec(sql);
  await backfillDb.exec(sqlHardening);
  await backfillDb.exec(sqlAiStrategy);
  await backfillDb.exec(sqlAiStrategyIndexes);
  await backfillDb.exec(sqlApproval);
  await backfillDb.exec(sqlInstagramReadonly);
  await backfillDb.exec(sqlContextNotes);
  await backfillDb.exec(sqlGoogleOnlyAuth);
  await backfillDb.exec(sqlRestringirAcesso);
  await backfillDb.exec(sqlImportRun);
  await backfillDb.exec(sqlComentarios);
  await backfillDb.exec(sqlNotaEdicao);
  await backfillDb.exec(sqlInsight);
  await backfillDb.exec(sqlImagem);
  await backfillDb.exec(sqlFixAprovacao);
  await backfillDb.exec(sqlFixAuditoriaInsight);
  // Ainda sem 0030 — reproduz o estado real do banco antes desta migração existir.
  // Sem troca de role: os inserts de fixture usam o mesmo papel que criou as tabelas
  // (dono, privilégios plenos), igual ao seed de auth.users no restante deste arquivo.

  const usuarioPreExistente = 'f1f1f1f1-1111-4111-8111-f1f1f1f1f1f1';
  const workspacePreExistenteId = 'f2f2f2f2-2222-4222-8222-f2f2f2f2f2f2';
  const igAccountPreExistenteId = 'f3f3f3f3-3333-4333-8333-f3f3f3f3f3f3';
  const connectionPreExistenteId = 'f4f4f4f4-4444-4444-8444-f4f4f4f4f4f4';
  const postA = 'ig-post-pre-existente-a';
  const postB = 'ig-post-pre-existente-b';

  await backfillDb.query('insert into auth.users (id) values ($1)', [usuarioPreExistente]);
  await backfillDb.query(
    `insert into public.marketing_workspace (id, nome, criado_por, idempotency_key)
     values ($1, 'Workspace pré-existente', $2, $3)`,
    [workspacePreExistenteId, usuarioPreExistente, 'f5f5f5f5-5555-4555-8555-f5f5f5f5f5f5'],
  );
  await backfillDb.query(
    "insert into public.ig_account (id, user_id, username) values ($1, $2, 'atol.ia.oficial')",
    [igAccountPreExistenteId, usuarioPreExistente],
  );
  await backfillDb.query(
    `insert into public.marketing_instagram_connection (id, workspace_id, ig_account_id, username, conectado_por)
     values ($1, $2, $3, 'atol.ia.oficial', $4)`,
    [connectionPreExistenteId, workspacePreExistenteId, igAccountPreExistenteId, usuarioPreExistente],
  );

  // Post A: duas observações históricas (reimportação antes da correção) — a mais
  // recente traz o permalink/media_type que devem sobreviver ao backfill.
  await backfillDb.query(
    `insert into public.marketing_instagram_metric_snapshot
       (workspace_id, connection_id, ig_media_id, media_type, permalink, publicado_em, metricas, coletado_em)
     values
       ($1, $2, $3, 'IMAGE', 'https://instagram.com/p/a-antigo', '2026-01-10T00:00:00Z', $4::jsonb, '2026-01-10T08:00:00Z'),
       ($1, $2, $3, 'IMAGE', 'https://instagram.com/p/a-atual', '2026-01-10T00:00:00Z', $5::jsonb, '2026-01-15T08:00:00Z')`,
    [
      workspacePreExistenteId, connectionPreExistenteId, postA,
      JSON.stringify({ likes: 10, comentarios: 1 }),
      JSON.stringify({ likes: 40, comentarios: 4 }),
    ],
  );
  // Post B: uma única observação.
  await backfillDb.query(
    `insert into public.marketing_instagram_metric_snapshot
       (workspace_id, connection_id, ig_media_id, media_type, permalink, publicado_em, metricas, coletado_em)
     values ($1, $2, $3, 'VIDEO', 'https://instagram.com/p/b', '2026-01-05T00:00:00Z', $4::jsonb, '2026-01-05T08:00:00Z')`,
    [workspacePreExistenteId, connectionPreExistenteId, postB, JSON.stringify({ likes: 7, comentarios: 0 })],
  );

  await backfillDb.exec(sqlMediaDimension);

  const dimensaoBackfillada = await backfillDb.query(
    `select ig_media_id, media_type, permalink, publicado_em
       from public.marketing_instagram_media
      where workspace_id = $1
      order by ig_media_id`,
    [workspacePreExistenteId],
  );
  assert.equal(
    dimensaoBackfillada.rows.length, 2,
    'O backfill deveria criar uma linha de dimensão por mídia distinta, não uma por snapshot.',
  );
  const dimensaoPostA = dimensaoBackfillada.rows.find((r) => r.ig_media_id === postA);
  assert.equal(
    dimensaoPostA.permalink, 'https://instagram.com/p/a-atual',
    'O backfill deveria usar os dados do snapshot mais recente de cada mídia (distinct on ... order by coletado_em desc).',
  );

  const snapshotsPreservados = await backfillDb.query(
    'select count(*)::integer as total from public.marketing_instagram_metric_snapshot where workspace_id = $1',
    [workspacePreExistenteId],
  );
  assert.equal(
    snapshotsPreservados.rows[0].total, 3,
    'O backfill não deveria apagar nem alterar o histórico de snapshots já coletado.',
  );

  console.log('Migração 0030: backfill preservou o histórico já coletado antes desta migração existir.');
} finally {
  await backfillDb.close();
}
