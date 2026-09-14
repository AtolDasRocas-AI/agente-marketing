/**
 * EXECUTA O SORTEIO e grava o resultado (append-only).
 *
 *   node scripts/executar-sorteio.mjs <SORTEIO_ID> "<SEMENTE-PUBLICADA>" ["onde publicou"]
 *
 * Usa o MESMO motor do app (app/src/lib/sorteio/sorteio.ts).
 * Também exporta o CSV para o verificador público.
 */
import pg from 'pg';
import { writeFileSync } from 'node:fs';
import { sortear } from '../app/src/lib/sorteio/sorteio.ts';

const [sorteioId, semente, fonte = 'Publicada nos stories antes da execução'] = process.argv.slice(2);
if (!sorteioId || !semente) {
  console.log('Uso: node scripts/executar-sorteio.mjs <SORTEIO_ID> "<SEMENTE>" ["onde publicou"]');
  process.exit(1);
}

const db = new pg.Client({
  host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432,
  user: 'postgres.uakwbtmbhwifiekwmsbq', database: 'postgres',
  password: 'CavaloMarinho123!', ssl: { rejectUnauthorized: false },
});
await db.connect();

const { rows: [sorteio] } = await db.query('select * from sorteio where id = $1', [sorteioId]);
if (!sorteio) { console.error('❌ Sorteio não encontrado.'); process.exit(1); }

// E-18: bloqueia re-execução
const { rows: [jaTem] } = await db.query('select id from resultado where sorteio_id = $1', [sorteioId]);
if (jaTem) {
  console.error('❌ E-18: este sorteio já foi executado. Crie uma nova rodada para o mesmo post.');
  process.exit(1);
}

// congela o snapshot (RNF-06)
await db.query(`update sorteio set status = 'ENCERRADO', encerrado_em = now() where id = $1`, [sorteioId]);

const { rows: chancesDb } = await db.query(
  `select c.ordem, c.autor_username, cm.ig_comment_id
   from chance c join comentario cm on cm.id = c.comentario_id
   where c.sorteio_id = $1 order by c.ordem`, [sorteioId]
);
if (chancesDb.length === 0) {
  console.error('❌ E-14: nenhum participante habilitado. Sorteio bloqueado.');
  process.exit(1);
}

const { rows: [contagens] } = await db.query(
  `select
     (select count(*)::int from comentario where sorteio_id = $1) as total_comentarios,
     (select count(*)::int from qualificacao where sorteio_id = $1
        and status in ('HABILITADO','SUSPEITO')) as total_habilitados`,
  [sorteioId]
);

let r;
try {
  r = await sortear(chancesDb, semente, sorteio.qtd_vencedores, sorteio.qtd_suplentes);
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}

await db.query(
  `insert into resultado (sorteio_id, seed_publica, seed_fonte, hash_lista,
     total_comentarios, total_habilitados, total_chances, vencedores, suplentes)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
  [sorteioId, semente, fonte, r.hash_lista, contagens.total_comentarios,
   contagens.total_habilitados, r.total_chances,
   JSON.stringify(r.vencedores), JSON.stringify(r.suplentes)]
);
await db.query(`update sorteio set status = 'SORTEADO', seed_publica = $2, seed_fonte = $3, hash_lista = $4 where id = $1`,
  [sorteioId, semente, fonte, r.hash_lista]);

// CSV para o verificador público (AC-15)
const csv = 'ordem,autor_username,ig_comment_id\n' +
  chancesDb.map((c) => `${c.ordem},${c.autor_username},${c.ig_comment_id}`).join('\n');
const caminhoCsv = new URL(`../comprovantes/participantes-${sorteioId.slice(0, 8)}.csv`, import.meta.url);
writeFileSync(caminhoCsv, csv);

console.log('\n╔══════════════ COMPROVANTE DO SORTEIO ══════════════╗');
console.log(`  post:              ${sorteio.permalink}`);
console.log(`  título:            ${sorteio.titulo}`);
console.log(`  executado em:      ${new Date().toISOString()} (UTC)`);
console.log(`  semente pública:   ${semente}`);
console.log(`  fonte da semente:  ${fonte}`);
console.log(`  hash_lista:        ${r.hash_lista}`);
console.log(`  seed_final:        ${r.seed_final}`);
console.log(`  total comentários: ${contagens.total_comentarios}`);
console.log(`  habilitados:       ${contagens.total_habilitados}`);
console.log(`  chances na urna:   ${r.total_chances}`);
console.log('╠════════════════════════════════════════════════════╣');
console.log('  🏆 VENCEDOR' + (r.vencedores.length > 1 ? 'ES' : ''));
r.vencedores.forEach((v, i) => console.log(`     ${i + 1}. @${v.autor_username}`));
console.log('  🎗️  SUPLENTES');
r.suplentes.forEach((v, i) => console.log(`     ${i + 1}. @${v.autor_username}`));
console.log('╚════════════════════════════════════════════════════╝');
console.log(`\n📄 CSV: comprovantes/participantes-${sorteioId.slice(0, 8)}.csv`);
console.log('🔍 Verifique com:');
console.log(`   node verificador/verificar.mjs "comprovantes/participantes-${sorteioId.slice(0, 8)}.csv" "${semente}" ${sorteio.qtd_vencedores} ${sorteio.qtd_suplentes}\n`);

await db.end();
