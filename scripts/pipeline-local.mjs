/**
 * PIPELINE COMPLETO LOCAL — Ondas 1→4 com dados reais.
 *
 * Faz o que as Edge Functions farão em produção, mas rodando aqui:
 *   1. registra a conta Instagram + token no banco
 *   2. cria o sorteio a partir do link do post
 *   3. importa TODOS os comentários (paginado, idempotente)
 *   4. roda o motor de regras e materializa as chances
 *
 * Usa os MESMOS módulos do app (app/src/lib/**), então o que passar
 * aqui é o que roda na interface.
 *
 * Uso:
 *   node scripts/pipeline-local.mjs [link-do-post] [opções]
 *
 * Opções (todas opcionais):
 *   --mencoes N        menções mínimas (padrão 1; 0 desativa)
 *   --palavra "TEXTO"  palavra/hashtag obrigatória no comentário
 *   --vencedores N     quantos ganham prêmio (padrão 1 → 1º, 2º, 3º…)
 *   --suplentes N      reservas (padrão 3)
 *   --modo pessoa|comentario   1 chance por pessoa (padrão) ou por comentário
 *   --teto N           teto de chances por pessoa no modo comentario (padrão 3)
 *   --nova             força criar nova rodada em vez de reusar a aberta
 *
 * Ex.: node scripts/pipeline-local.mjs --vencedores 3 --palavra "EU QUERO"
 */
import { criarClienteBanco } from './_database.mjs';
import { readFileSync } from 'node:fs';
import { classificar, montarChances } from '../app/src/lib/sorteio/regras.ts';

const PERMALINK_PADRAO = 'https://www.instagram.com/p/DbtE-tsuEWU/';

const args = process.argv.slice(2);
const opcao = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : padrao;
};
const temFlag = (nome) => args.includes(`--${nome}`);

const permalinkAlvo = args.find((a) => a.includes('instagram.com')) || PERMALINK_PADRAO;
const CFG = {
  mencoes: Number(opcao('mencoes', 1)),
  palavra: opcao('palavra', null),
  vencedores: Number(opcao('vencedores', 1)),
  suplentes: Number(opcao('suplentes', 3)),
  modo: opcao('modo', 'pessoa') === 'comentario' ? 'POR_COMENTARIO' : 'POR_PESSOA',
  teto: Number(opcao('teto', 3)),
  nova: temFlag('nova'),
};
const GRAPH = 'https://graph.instagram.com';
const ORGANIZADOR = 'atol.ia.oficial';
const EMAIL_ORGANIZADOR = 'atoldasrocas.ai@gmail.com';

const { access_token: TOKEN, expira_em } = JSON.parse(
  readFileSync(new URL('../spike/token.json', import.meta.url), 'utf8')
);

const shortcodeDe = (url) => {
  const m = String(url ?? '').match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
};

const db = criarClienteBanco();
await db.connect();
console.log('🔌 Conectado ao Postgres\n');

// ─── 1. conta + token ───────────────────────────────────────────
const { rows: [user] } = await db.query('select id from auth.users where email = $1', [EMAIL_ORGANIZADOR]);
if (!user) { console.error(`❌ Usuário ${EMAIL_ORGANIZADOR} não existe no auth.`); process.exit(1); }

const perfil = await (await fetch(`${GRAPH}/me?fields=user_id,username&access_token=${TOKEN}`)).json();
if (!perfil.username) { console.error('❌ Token inválido:', JSON.stringify(perfil)); process.exit(1); }

const { rows: [conta] } = await db.query(
  `select * from salvar_conta_instagram($1,$2,$3,$4,$5)`,
  [user.id, String(perfil.user_id ?? perfil.id), perfil.username, TOKEN, expira_em]
);
console.log(`✅ Conta @${conta.username} registrada (token expira ${new Date(conta.token_expira_em).toLocaleDateString('pt-BR')})`);

// ─── 2. resolve o permalink e cria o sorteio ─────────────────────
const alvo = shortcodeDe(permalinkAlvo);
if (!alvo) { console.error('❌ Permalink inválido:', permalinkAlvo); process.exit(1); }

let midia = null;
let url = `${GRAPH}/me/media?fields=id,caption,media_type,permalink,timestamp,comments_count&limit=50&access_token=${TOKEN}`;
while (url && !midia) {
  const body = await (await fetch(url)).json();
  if (body.error) { console.error('❌ Graph API:', JSON.stringify(body.error)); process.exit(1); }
  midia = body.data.find((m) => shortcodeDe(m.permalink) === alvo) ?? null;
  url = body.paging?.next ?? null;
}
if (!midia) { console.error(`❌ Post ${alvo} não pertence a @${perfil.username} (E-19)`); process.exit(1); }

const titulo = (midia.caption ?? 'Sorteio').split('\n')[0].slice(0, 80);
console.log(`✅ Post resolvido: ${midia.id} | 💬 ${midia.comments_count} comentários`);
console.log(`   "${titulo}"`);

// idempotente: reusa a rodada aberta deste post, se existir (--nova força outra)
const { rows: [aberto] } = CFG.nova
  ? { rows: [] }
  : await db.query(
      `select * from sorteio
       where account_id = $1 and ig_media_id = $2 and status in ('RASCUNHO','IMPORTANDO','PRONTO')
       order by criado_em desc limit 1`,
      [conta.id, midia.id]
    );

let sorteio = aberto;
if (sorteio) {
  // aplica a configuração atual na rodada reusada
  ({ rows: [sorteio] } = await db.query(
    `update sorteio set modo = $2, teto_chances = $3, mencoes_minimas = $4,
       palavra_chave = $5, qtd_vencedores = $6, qtd_suplentes = $7
     where id = $1 returning *`,
    [sorteio.id, CFG.modo, CFG.modo === 'POR_COMENTARIO' ? CFG.teto : null,
     CFG.mencoes, CFG.palavra, CFG.vencedores, CFG.suplentes]
  ));
  console.log(`♻️  Reusando sorteio aberto: ${sorteio.id}`);
} else {
  ({ rows: [sorteio] } = await db.query(
    `insert into sorteio (account_id, ig_media_id, permalink, titulo, status,
       modo, teto_chances, mencoes_minimas, palavra_chave, qtd_vencedores, qtd_suplentes)
     values ($1,$2,$3,$4,'IMPORTANDO',$5,$6,$7,$8,$9,$10)
     returning *`,
    [conta.id, midia.id, midia.permalink, titulo, CFG.modo,
     CFG.modo === 'POR_COMENTARIO' ? CFG.teto : null,
     CFG.mencoes, CFG.palavra, CFG.vencedores, CFG.suplentes]
  ));
  console.log(`✅ Sorteio criado: ${sorteio.id}`);
}
console.log(
  `⚙️  Regras: ${CFG.mencoes} menção(ões) mín.` +
  `${CFG.palavra ? ` · palavra "${CFG.palavra}"` : ''}` +
  ` · ${CFG.modo === 'POR_PESSOA' ? '1 chance/pessoa' : `por comentário (teto ${CFG.teto})`}` +
  ` · ${CFG.vencedores} ganhador(es) + ${CFG.suplentes} suplente(s)\n`
);

// ─── 3. importa comentários (paginado + idempotente) ────────────
const campos = 'id,text,timestamp,from{id,username},replies{id}';
let cursor = null, pagina = 0, novos = 0;
url = `${GRAPH}/${midia.id}/comments?fields=${campos}&limit=50&access_token=${TOKEN}`;

process.stdout.write('📥 Importando: ');
while (url) {
  let res, tentativa = 0;
  while (true) { // backoff em 429/5xx (RNF-04)
    res = await fetch(url);
    if (res.ok || (res.status !== 429 && res.status < 500) || tentativa >= 4) break;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** tentativa++));
  }
  const body = await res.json();
  if (!res.ok) { console.error('\n❌ Graph API:', JSON.stringify(body.error)); process.exit(1); }

  for (const c of body.data ?? []) {
    const r = await db.query(
      `insert into comentario (sorteio_id, ig_comment_id, autor_username, texto, publicado_em, is_reply)
       values ($1,$2,$3,$4,$5,false)
       on conflict (sorteio_id, ig_comment_id) do nothing`,
      [sorteio.id, c.id, c.from?.username ?? null, c.text ?? '', c.timestamp]
    );
    novos += r.rowCount;
  }
  cursor = body.paging?.cursors?.after ?? cursor;
  url = body.paging?.next ?? null;
  pagina++;
  process.stdout.write('.');
}

const { rows: [{ total }] } = await db.query(
  'select count(*)::int as total from comentario where sorteio_id = $1', [sorteio.id]
);
console.log(`\n✅ ${total} comentários no banco (${pagina} páginas, ${novos} inseridos)`);

// idempotência: reimportar a primeira página não deve duplicar (AC-05)
const primeira = await (await fetch(
  `${GRAPH}/${midia.id}/comments?fields=${campos}&limit=50&access_token=${TOKEN}`
)).json();
for (const c of primeira.data ?? []) {
  await db.query(
    `insert into comentario (sorteio_id, ig_comment_id, autor_username, texto, publicado_em, is_reply)
     values ($1,$2,$3,$4,$5,false) on conflict (sorteio_id, ig_comment_id) do nothing`,
    [sorteio.id, c.id, c.from?.username ?? null, c.text ?? '', c.timestamp]
  );
}
const { rows: [{ total: total2 }] } = await db.query(
  'select count(*)::int as total from comentario where sorteio_id = $1', [sorteio.id]
);
console.log(`✅ AC-05 idempotência: ${total} → ${total2} ${total === total2 ? '(sem duplicatas ✓)' : '❌ DUPLICOU'}`);

// ─── 4. motor de regras + chances ───────────────────────────────
const { rows: comentarios } = await db.query(
  `select id, ig_comment_id, autor_username, texto, publicado_em, is_reply
   from comentario where sorteio_id = $1`, [sorteio.id]
);

const classificacoes = classificar(
  comentarios.map((c) => ({ ...c, publicado_em: new Date(c.publicado_em).toISOString() })),
  {
    organizador: ORGANIZADOR,
    modo: sorteio.modo,
    teto_chances: sorteio.teto_chances,
    mencoes_minimas: sorteio.mencoes_minimas,
    teto_mencoes: sorteio.teto_mencoes,
    palavra_chave: sorteio.palavra_chave,
    janela_inicio: sorteio.janela_inicio,
    janela_fim: sorteio.janela_fim,
  }
);

for (const c of classificacoes) {
  await db.query(
    `insert into qualificacao (sorteio_id, comentario_id, status, motivo, mencoes_validas)
     values ($1,$2,$3,$4,$5) on conflict (comentario_id) do update
       set status = excluded.status, motivo = excluded.motivo, mencoes_validas = excluded.mencoes_validas`,
    [sorteio.id, c.comentario_id, c.status, c.motivo ?? (c.flags[0] ?? null), c.mencoes_validas]
  );
}

const chances = montarChances(classificacoes);
await db.query('delete from chance where sorteio_id = $1', [sorteio.id]);
for (const ch of chances) {
  await db.query(
    `insert into chance (sorteio_id, ordem, autor_username, comentario_id) values ($1,$2,$3,$4)`,
    [sorteio.id, ch.ordem, ch.autor_username, ch.comentario_id]
  );
}
await db.query(`update sorteio set status = 'PRONTO' where id = $1`, [sorteio.id]);

// ─── relatório ──────────────────────────────────────────────────
const porStatus = new Map();
const porMotivo = new Map();
for (const c of classificacoes) {
  porStatus.set(c.status, (porStatus.get(c.status) ?? 0) + 1);
  if (c.motivo) porMotivo.set(c.motivo, (porMotivo.get(c.motivo) ?? 0) + 1);
}

console.log('\n══════ QUALIFICAÇÃO (dados reais) ══════');
for (const [s, n] of [...porStatus].sort((a, b) => b[1] - a[1])) console.log(`  ${s.padEnd(16)} ${n}`);
console.log('\n  motivos:');
for (const [m, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) console.log(`    ${m.padEnd(24)} ${n}`);
console.log(`\n🎟️  CHANCES NA URNA: ${chances.length}`);
console.log(`   autores distintos: ${new Set(chances.map((c) => c.autor_username)).size}`);
console.log(`\n📌 SORTEIO_ID = ${sorteio.id}`);
console.log('   Próximo passo: node scripts/executar-sorteio.mjs <SORTEIO_ID> "<SEMENTE>"\n');

await db.end();
