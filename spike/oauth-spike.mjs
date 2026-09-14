/**
 * SPIKE DESCARTÁVEL — Onda 0 do spec-kit sorteio-instagram
 *
 * Objetivo único: provar que o OAuth fecha em Dev Mode e imprimir no
 * terminal o JSON de comentários de um post próprio. Também valida a
 * premissa P-08 (resolução de permalink → media_id).
 *
 * Uso:
 *   1. Preencha spike/.env (copie de .env.example)
 *   2. node spike/oauth-spike.mjs
 *   3. Abra a URL de autorização impressa, faça login e autorize
 *   4. O script captura o callback, troca os tokens e imprime tudo
 *
 * Re-execuções: se spike/token.json existir e o token não estiver
 * expirado, o script pula o OAuth e vai direto para mídia/comentários.
 *
 * Teste de permalink (P-08):
 *   node spike/oauth-spike.mjs https://www.instagram.com/p/SHORTCODE/
 *
 * Zero dependências — Node 18+ (fetch nativo).
 */

import { createServer } from 'node:https';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = join(DIR, 'token.json');

// ---------- .env manual (sem dependências) ----------
function carregarEnv() {
  const envPath = join(DIR, '.env');
  if (!existsSync(envPath)) {
    console.error('❌ spike/.env não encontrado. Copie spike/.env.example e preencha.');
    process.exit(1);
  }
  for (const linha of readFileSync(envPath, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv();

const APP_ID = process.env.IG_APP_ID;
const APP_SECRET = process.env.IG_APP_SECRET;
const REDIRECT_URI = process.env.IG_REDIRECT_URI || 'https://localhost:5173/auth/callback';

// Certificado self-signed para o https local (o Meta exige redirect https).
// Gerado com openssl; o navegador vai alertar "não seguro" — clique em
// Avançado → Continuar para localhost. É esperado e seguro em dev.
const TLS = {
  key: readFileSync(join(DIR, 'key.pem')),
  cert: readFileSync(join(DIR, 'cert.pem')),
};

if (!APP_ID || !APP_SECRET) {
  console.error('❌ IG_APP_ID e IG_APP_SECRET são obrigatórios no spike/.env');
  process.exit(1);
}

// ⚠️ Nomes de scopes mudam com frequência no Meta. Estes são os do
// produto "Instagram API with Instagram Login". Confirme na doc oficial
// se a tela de autorização reclamar de scope inválido.
const SCOPES = 'instagram_business_basic,instagram_business_manage_comments';
const GRAPH = 'https://graph.instagram.com';

// --code "<code ou URL de callback inteira>" pula o servidor local
const idxCode = process.argv.indexOf('--code');
const codeManual = idxCode > -1 ? extrairCode(process.argv[idxCode + 1]) : null;
const permalinkAlvo = process.argv.filter((a, i) => i >= 2 && a !== '--code' && i !== idxCode + 1)[0] || null;

function extrairCode(valor) {
  if (!valor) return null;
  try { return new URL(valor).searchParams.get('code') || valor; }
  catch { return valor; }
}

// ---------- helpers ----------
async function getJson(url, rotulo) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    console.error(`❌ ${rotulo} falhou (HTTP ${res.status}):`);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }
  return body;
}

function shortcodeDe(url) {
  const m = String(url).match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// ---------- fase 1: obter token ----------
async function obterToken() {
  // token salvo de execução anterior?
  if (existsSync(TOKEN_FILE)) {
    const salvo = JSON.parse(readFileSync(TOKEN_FILE, 'utf8'));
    if (new Date(salvo.expira_em) > new Date()) {
      console.log(`🔑 Reusando token salvo (expira em ${salvo.expira_em})\n`);
      return salvo.access_token;
    }
    console.log('⚠️ Token salvo expirado — refazendo OAuth.\n');
  }

  if (codeManual) {
    console.log('🔑 Usando code passado via --code (sem servidor local)\n');
    return trocarCode(codeManual);
  }

  const authUrl =
    `https://www.instagram.com/oauth/authorize` +
    `?client_id=${APP_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${SCOPES}`;

  const porta = new URL(REDIRECT_URI).port || 443;
  const caminho = new URL(REDIRECT_URI).pathname;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👉 ABRA ESTA URL NO NAVEGADOR (logado na conta tester):\n');
  console.log(authUrl);
  console.log('\n⏳ Aguardando callback em ' + REDIRECT_URI + ' ...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const code = await new Promise((resolve, reject) => {
    const server = createServer(TLS, (req, res) => {
      const url = new URL(req.url, `https://localhost:${porta}`);
      if (url.pathname !== caminho) { res.writeHead(404).end(); return; }
      const code = url.searchParams.get('code');
      const erro = url.searchParams.get('error_description') || url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(code
        ? '<h1>✅ Código recebido — volte ao terminal.</h1>'
        : `<h1>❌ Erro: ${erro}</h1>`);
      server.close();
      code ? resolve(code) : reject(new Error(erro || 'sem code no callback'));
    });
    server.listen(porta, () => {});
  });

  console.log('✅ Code recebido. Trocando por token de curta duração...');
  return trocarCode(code);
}

async function trocarCode(code) {
  // code → short-lived (o Instagram anexa "#_" ao code em alguns fluxos)
  const form = new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code: code.replace(/#_$/, ''),
  });
  const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: form,
  });
  const shortBody = await shortRes.json();
  if (!shortRes.ok || !shortBody.access_token) {
    console.error('❌ Troca code→short-lived falhou:');
    console.error(JSON.stringify(shortBody, null, 2));
    process.exit(1);
  }
  console.log(`✅ Short-lived ok (user_id: ${shortBody.user_id}). Fazendo upgrade para long-lived...`);

  // short → long-lived (~60 dias)
  const longBody = await getJson(
    `${GRAPH}/access_token?grant_type=ig_exchange_token` +
    `&client_secret=${APP_SECRET}&access_token=${shortBody.access_token}`,
    'Upgrade para long-lived'
  );

  const expiraEm = new Date(Date.now() + longBody.expires_in * 1000).toISOString();
  writeFileSync(TOKEN_FILE, JSON.stringify({
    access_token: longBody.access_token,
    user_id: shortBody.user_id,
    expira_em: expiraEm,
  }, null, 2));

  console.log(`✅ LONG-LIVED OBTIDO — expira em ${expiraEm} (~${Math.round(longBody.expires_in / 86400)} dias)`);
  console.log(`   Salvo em spike/token.json (gitignored)\n`);
  return longBody.access_token;
}

// ---------- fase 2: mídia + comentários ----------
async function main() {
  const token = await obterToken();

  console.log('📸 Buscando mídias da conta (GET /me/media)...\n');
  const campos = 'id,caption,media_type,permalink,timestamp,comments_count';
  let url = `${GRAPH}/me/media?fields=${campos}&limit=25&access_token=${token}`;
  const midias = [];
  let paginas = 0;
  while (url && paginas < 10) {
    const body = await getJson(url, 'GET /me/media');
    midias.push(...(body.data || []));
    url = body.paging?.next || null;
    paginas++;
  }

  if (midias.length === 0) {
    console.error('❌ Nenhuma mídia retornada. A conta tem posts? O scope está certo?');
    process.exit(1);
  }

  console.log(`✅ ${midias.length} mídias encontradas (${paginas} página(s)):\n`);
  for (const m of midias.slice(0, 10)) {
    const legenda = (m.caption || '(sem legenda)').slice(0, 50).replace(/\n/g, ' ');
    console.log(`   ${m.id} | ${m.media_type} | 💬 ${m.comments_count} | ${m.timestamp?.slice(0, 10)} | ${legenda}`);
  }

  // P-08: resolução de permalink → media_id
  let alvo;
  if (permalinkAlvo) {
    const sc = shortcodeDe(permalinkAlvo);
    if (!sc) { console.error(`❌ Permalink inválido: ${permalinkAlvo}`); process.exit(1); }
    alvo = midias.find(m => shortcodeDe(m.permalink) === sc);
    if (!alvo) {
      console.error(`\n❌ P-08 FALHOU: shortcode "${sc}" não encontrado nas ${midias.length} mídias da conta.`);
      process.exit(1);
    }
    console.log(`\n✅ P-08 VALIDADA: permalink resolvido → media_id ${alvo.id}`);
  } else {
    alvo = midias.find(m => m.comments_count > 0) || midias[0];
    console.log(`\nℹ️ Nenhum permalink passado — usando o post mais recente com comentários: ${alvo.id}`);
  }

  console.log(`\n💬 Buscando comentários de ${alvo.id} (${alvo.permalink})...\n`);
  // ⚠️ Achado do spike: o autor vem em from{username}, NÃO em "username"
  // (o campo "username" retorna vazio nesse produto de API)
  const bodyComentarios = await getJson(
    `${GRAPH}/${alvo.id}/comments?fields=id,text,timestamp,from{id,username},like_count,replies{id}&limit=50&access_token=${token}`,
    'GET /{media-id}/comments'
  );

  console.log('━━━━━━━━━━━━━━━━ JSON DE COMENTÁRIOS ━━━━━━━━━━━━━━━━');
  console.log(JSON.stringify(bodyComentarios, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const total = bodyComentarios.data?.length ?? 0;
  console.log(`\n🎉 GATE DA ONDA 0 FECHADO:`);
  console.log(`   ✅ Token long-lived obtido e salvo`);
  console.log(`   ✅ ${midias.length} mídias listadas`);
  console.log(`   ${permalinkAlvo ? '✅' : '⬜'} P-08 (permalink → media_id)${permalinkAlvo ? '' : ' — rode de novo passando um permalink para validar'}`);
  console.log(`   ✅ ${total} comentário(s) impressos no terminal${bodyComentarios.paging?.next ? ' (há mais páginas — paginação confirmada)' : ''}`);
  console.log(`\n▶️ Próximo passo: /z-execute-spec-kit sorteio-instagram --onda 1`);
}

main().catch(e => { console.error('❌ Erro inesperado:', e); process.exit(1); });
