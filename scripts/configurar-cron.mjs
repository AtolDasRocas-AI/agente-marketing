/**
 * Configura os segredos do Vault e aplica as migrações pendentes,
 * habilitando os jobs automáticos (AC-02 refresh de token, AC-16 expurgo).
 *
 * A service key é lida do CLI do Supabase e gravada direto no Vault —
 * nunca é impressa no terminal nem versionada.
 *
 *   node scripts/configurar-cron.mjs
 */
import pg from 'pg';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const REF = 'uakwbtmbhwifiekwmsbq';
const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\//, '');

const token = readFileSync(`${RAIZ}.supabase-token`, 'utf8').trim();
const chaves = JSON.parse(
  execSync(`npx supabase projects api-keys --project-ref ${REF} -o json`, {
    encoding: 'utf8',
    cwd: RAIZ,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
  })
);
const serviceKey = chaves.find((k) => k.name === 'service_role')?.api_key;
if (!serviceKey) {
  console.error('❌ service_role key não encontrada.');
  process.exit(1);
}

// segredo dedicado ao cron: mesmo valor nas Edge Functions e no Vault
const arquivoSegredo = `${RAIZ}.cron-secret`;
const cronSecret = existsSync(arquivoSegredo)
  ? readFileSync(arquivoSegredo, 'utf8').trim()
  : randomBytes(32).toString('hex');
writeFileSync(arquivoSegredo, cronSecret + '\n');

execSync(`npx supabase secrets set CRON_SECRET=${cronSecret} --project-ref ${REF}`, {
  cwd: RAIZ,
  stdio: 'pipe',
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
});
console.log('✅ CRON_SECRET configurado nas Edge Functions');

const db = new pg.Client({
  host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432,
  user: `postgres.${REF}`, database: 'postgres',
  password: 'CavaloMarinho123!', ssl: { rejectUnauthorized: false },
});
await db.connect();
console.log('🔌 Conectado\n');

// ── 1. segredos no Vault ──
await db.query('create extension if not exists supabase_vault cascade');
for (const [nome, valor] of [
  ['projeto_url', `https://${REF}.supabase.co`],
  ['service_role_key', serviceKey],
  ['cron_secret', cronSecret],
]) {
  const { rows } = await db.query('select id from vault.secrets where name = $1', [nome]);
  if (rows.length) {
    await db.query('select vault.update_secret($1, $2, $3)', [rows[0].id, valor, nome]);
    console.log(`♻️  segredo "${nome}" atualizado`);
  } else {
    await db.query('select vault.create_secret($1, $2)', [valor, nome]);
    console.log(`✅ segredo "${nome}" criado`);
  }
}

// ── 2. migrações pendentes ──
const dir = `${RAIZ}supabase/migrations`;
await db.query('create table if not exists _migracoes (nome text primary key, aplicada_em timestamptz default now())');
const { rows: aplicadas } = await db.query('select nome from _migracoes');
const jaAplicadas = new Set(aplicadas.map((r) => r.nome));

console.log('');
for (const nome of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  if (jaAplicadas.has(nome)) { console.log(`⏭️  ${nome}`); continue; }
  const sql = readFileSync(`${dir}/${nome}`, 'utf8');
  try {
    await db.query('begin');
    await db.query(sql);
    await db.query('insert into _migracoes (nome) values ($1)', [nome]);
    await db.query('commit');
    console.log(`✅ ${nome} aplicada`);
  } catch (e) {
    await db.query('rollback');
    console.error(`❌ ${nome}: ${e.message}`);
    await db.end();
    process.exit(1);
  }
}

// ── 3. conferência ──
const { rows: jobs } = await db.query(
  'select jobname, schedule, active from cron.job order by jobname'
);
console.log('\n⏰ JOBS AGENDADOS');
for (const j of jobs) {
  console.log(`   ${j.active ? '●' : '○'} ${j.jobname.padEnd(26)} ${j.schedule}`);
}

console.log('\n🧪 Teste imediato do refresh de token (sem esperar as 03:10):');
try {
  const { rows: [r] } = await db.query(`select chamar_edge_function('ig-token-refresh') as id`);
  // pg_net é assíncrono: espera a resposta aparecer
  let resposta = null;
  for (let i = 0; i < 15 && !resposta; i++) {
    await new Promise((s) => setTimeout(s, 1000));
    const { rows } = await db.query(
      'select status_code, left(coalesce(content, \'\'), 300) as corpo from net._http_response where id = $1',
      [r.id]
    );
    resposta = rows[0] ?? null;
  }
  if (!resposta) {
    console.log(`   requisição ${r.id} enviada — resposta ainda em fila.`);
  } else if (resposta.status_code === 200) {
    console.log(`   ✅ HTTP 200 — ${resposta.corpo.replace(/\s+/g, ' ')}`);
  } else {
    console.log(`   ❌ HTTP ${resposta.status_code} — ${resposta.corpo.replace(/\s+/g, ' ')}`);
  }
} catch (e) {
  console.log(`   ⚠️ ${e.message}`);
}

await db.end();
