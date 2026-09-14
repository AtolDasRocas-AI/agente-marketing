/**
 * Confere se os jobs automáticos executaram de fato (AC-02, AC-16).
 *
 *   node scripts/verificar-jobs.mjs
 */
import pg from 'pg';

const db = new pg.Client({
  host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432,
  user: 'postgres.uakwbtmbhwifiekwmsbq', database: 'postgres',
  password: 'CavaloMarinho123!', ssl: { rejectUnauthorized: false },
});
await db.connect();

console.log('\n⏰ AGENDAMENTOS');
const { rows: jobs } = await db.query(
  'select jobname, schedule, active from cron.job order by jobname'
);
for (const j of jobs) console.log(`  ${j.active ? '●' : '○'} ${j.jobname.padEnd(26)} ${j.schedule}`);

console.log('\n📡 RESPOSTAS HTTP (pg_net) — chamadas às Edge Functions');
const { rows: respostas } = await db.query(`
  select id, status_code, left(coalesce(content,''), 220) as corpo, created
  from net._http_response order by id desc limit 5
`);
if (!respostas.length) console.log('  (nenhuma ainda — a chamada pode estar em fila)');
for (const r of respostas) {
  const marca = r.status_code === 200 ? '✅' : '❌';
  console.log(`  ${marca} #${r.id} HTTP ${r.status_code} · ${new Date(r.created).toLocaleTimeString('pt-BR')}`);
  console.log(`     ${r.corpo.replace(/\s+/g, ' ')}`);
}

console.log('\n🔑 TOKEN DA CONTA');
const { rows: contas } = await db.query(
  `select a.username, a.token_expira_em,
          (a.token_expira_em::date - current_date) as dias_restantes,
          t.atualizado_em as token_atualizado_em
   from ig_account a join privado.ig_token t on t.account_id = a.id`
);
for (const c of contas) {
  console.log(`  @${c.username} · expira em ${c.dias_restantes} dias (${new Date(c.token_expira_em).toLocaleDateString('pt-BR')})`);
  console.log(`  última gravação do token: ${new Date(c.token_atualizado_em).toLocaleString('pt-BR')}`);
}

console.log('\n📋 HISTÓRICO DE EXECUÇÃO DOS JOBS');
const { rows: runs } = await db.query(`
  select jobid, status, return_message, start_time
  from cron.job_run_details order by start_time desc limit 5
`).catch(() => ({ rows: [] }));
if (!runs.length) console.log('  (nenhuma execução agendada ainda — os jobs rodam às 03:10/03:40 UTC)');
for (const r of runs) {
  console.log(`  ${r.status === 'succeeded' ? '✅' : '⚠️'} job ${r.jobid} · ${r.status} · ${new Date(r.start_time).toLocaleString('pt-BR')}`);
}

await db.end();
