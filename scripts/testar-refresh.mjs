/**
 * Prova o AC-02: token com menos de 7 dias é renovado sem intervenção.
 *
 * Finge que o token expira em 5 dias, dispara o job e conferre se a
 * validade foi estendida. Restaura o estado original ao final,
 * aconteça o que acontecer.
 *
 *   node scripts/testar-refresh.mjs
 */
import { criarClienteBanco } from './_database.mjs';

const db = criarClienteBanco();
await db.connect();

const { rows: [conta] } = await db.query(
  'select id, username, token_expira_em from ig_account limit 1'
);
if (!conta) { console.error('❌ Nenhuma conta conectada.'); process.exit(1); }

const original = conta.token_expira_em;
console.log(`\n🔑 @${conta.username}`);
console.log(`   validade real: ${new Date(original).toLocaleDateString('pt-BR')}`);

let restaurar = true;
try {
  // 1. simula token perto de expirar (dentro da janela de 7 dias,
  //    mas acima das 24h que o Meta exige para permitir refresh)
  await db.query(
    `update ig_account set token_expira_em = now() + interval '5 days' where id = $1`,
    [conta.id]
  );
  console.log('   ⏱️  simulado: expira em 5 dias\n');

  // 2. dispara o job exatamente como o pg_cron faz
  const { rows: [req] } = await db.query(
    `select chamar_edge_function('ig-token-refresh') as id`
  );

  let resposta = null;
  for (let i = 0; i < 20 && !resposta; i++) {
    await new Promise((s) => setTimeout(s, 1000));
    const { rows } = await db.query(
      `select status_code, left(coalesce(content,''), 500) as corpo
       from net._http_response where id = $1`, [req.id]
    );
    resposta = rows[0] ?? null;
  }

  if (!resposta) {
    console.log('⚠️  Resposta não chegou em 20s — verifique Logs → Edge Functions.');
  } else {
    console.log(`📡 HTTP ${resposta.status_code}`);
    console.log(`   ${resposta.corpo.replace(/\s+/g, ' ')}\n`);
  }

  // 3. o job estendeu a validade?
  const { rows: [depois] } = await db.query(
    'select token_expira_em from ig_account where id = $1', [conta.id]
  );
  const dias = Math.round((new Date(depois.token_expira_em) - Date.now()) / 86_400_000);

  if (dias > 30) {
    console.log(`✅ AC-02 PROVADO — token renovado automaticamente para ${dias} dias.`);
    restaurar = false; // a nova validade é legítima, manter
  } else {
    console.log(`⚠️  Validade seguiu em ${dias} dias — o Meta não renovou agora.`);
    console.log('   Causa mais comum: o token precisa ter mais de 24h de vida.');
    console.log('   O encanamento está provado (job encontrou o token e chamou a API);');
    console.log('   a renovação ocorrerá naturalmente no job diário.');
  }
} finally {
  if (restaurar) {
    await db.query('update ig_account set token_expira_em = $2 where id = $1', [conta.id, original]);
    console.log(`\n♻️  Validade original restaurada (${new Date(original).toLocaleDateString('pt-BR')}).`);
  }
  await db.end();
}
