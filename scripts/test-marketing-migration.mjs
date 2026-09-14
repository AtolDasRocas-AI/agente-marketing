import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const migrationUrl = new URL('../supabase/migrations/0013_marketing_foundation.sql', import.meta.url);
const sql = await readFile(fileURLToPath(migrationUrl), 'utf8');

function exige(descricao, padrao) {
  assert.match(sql, padrao, `Migração 0013 sem garantia: ${descricao}`);
}

function proibe(descricao, padrao) {
  assert.doesNotMatch(sql, padrao, `Migração 0013 contém risco proibido: ${descricao}`);
}

assert.equal(sql.trimStart().includes('begin;'), true, 'A migração deve iniciar uma transação explícita.');
assert.equal(sql.trimEnd().endsWith('commit;'), true, 'A migração deve finalizar a transação explicitamente.');

const tabelasRls = [
  'marketing_workspace',
  'marketing_member',
  'marketing_content_item',
  'marketing_audit_event',
  'marketing_ai_run',
  'marketing_cost_ledger',
];
for (const tabela of tabelasRls) {
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

console.log(`Migração 0013: ${tabelasRls.length} tabelas com garantias estáticas verificadas.`);
