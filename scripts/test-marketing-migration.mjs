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

  console.log('Migrações 0013–0018: execução real e invariantes críticas verificadas no PostgreSQL descartável.');
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
