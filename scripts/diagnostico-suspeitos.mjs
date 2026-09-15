/**
 * Detalha POR QUE cada comentário foi marcado SUSPEITO.
 * Ajuda a calibrar as heurísticas antes do sorteio de verdade.
 *
 *   node scripts/diagnostico-suspeitos.mjs <SORTEIO_ID>
 */
import { criarClienteBanco } from './_database.mjs';
import { classificar } from '../app/src/lib/sorteio/regras.ts';

const sorteioId = process.argv[2];
if (!sorteioId) { console.log('Uso: node scripts/diagnostico-suspeitos.mjs <SORTEIO_ID>'); process.exit(1); }

const db = criarClienteBanco();
await db.connect();

const { rows: [s] } = await db.query('select * from sorteio where id = $1', [sorteioId]);
const { rows: comentarios } = await db.query(
  `select id, ig_comment_id, autor_username, texto, publicado_em, is_reply
   from comentario where sorteio_id = $1`, [sorteioId]
);

const classificacoes = classificar(
  comentarios.map((c) => ({ ...c, publicado_em: new Date(c.publicado_em).toISOString() })),
  {
    organizador: 'atol.ia.oficial',
    modo: s.modo, teto_chances: s.teto_chances,
    mencoes_minimas: s.mencoes_minimas, teto_mencoes: s.teto_mencoes,
    janela_inicio: s.janela_inicio, janela_fim: s.janela_fim,
  }
);

const porFlag = new Map();
for (const c of classificacoes) for (const f of c.flags) porFlag.set(f, (porFlag.get(f) ?? 0) + 1);

console.log('\n═══ FLAGS DE SUSPEITA (comentários podem ter mais de uma) ═══');
for (const [f, n] of [...porFlag].sort((a, b) => b[1] - a[1])) console.log(`  ${f.padEnd(20)} ${n}`);

const textoPorId = new Map(comentarios.map((c) => [c.id, c.texto]));
console.log('\n═══ AMOSTRA POR FLAG ═══');
for (const flag of porFlag.keys()) {
  console.log(`\n▸ ${flag}`);
  classificacoes
    .filter((c) => c.flags.includes(flag))
    .slice(0, 4)
    .forEach((c) => {
      const t = (textoPorId.get(c.comentario_id) ?? '').replace(/\s+/g, ' ').slice(0, 68);
      console.log(`   @${(c.autor_username ?? '?').padEnd(24)} "${t}"`);
    });
}

// quantos SUSPEITOS realmente entraram na urna
const naUrna = classificacoes.filter((c) => c.status === 'SUSPEITO').length;
console.log(`\n${naUrna} suspeitos seguem concorrendo (flag para revisão manual, não exclusão).`);
console.log('Para excluí-los, mude o modo de revisão na tela de participantes.\n');

await db.end();
