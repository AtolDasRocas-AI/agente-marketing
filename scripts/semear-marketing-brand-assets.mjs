/**
 * Popula o bucket privado `marketing-referencias-marca` (migration 0035) com as
 * referências visuais REAIS da marca ATOL, lidas do projeto real do app (fora deste
 * repo) e redimensionadas/comprimidas antes do upload.
 *
 * As chaves nunca são lidas de argumento de linha de comando — exporte-as na sua
 * própria sessão de terminal antes de rodar:
 *
 *   $env:SUPABASE_URL = 'https://uakwbtmbhwifiekwmsbq.supabase.co'
 *   $env:SUPABASE_SERVICE_ROLE_KEY = '...'
 *   node scripts/semear-marketing-brand-assets.mjs "C:\Users\User\Documents\Aquario marinho\reef-system-app"
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const BUCKET = 'marketing-referencias-marca';
const LADO_MAXIMO = 1280;

const ATIVOS = [
  { origem: 'public/atol-mark.webp', destino: 'logotipo-marca.webp', formato: 'webp', contentType: 'image/webp' },
  { origem: 'public/coral_reef_4k.webp', destino: 'clima-visual-recife.jpg', formato: 'jpeg', contentType: 'image/jpeg' },
  { origem: 'design-assets/play/raw/01-dashboard.png', destino: 'tela-dashboard.jpg', formato: 'jpeg', contentType: 'image/jpeg' },
  { origem: 'design-assets/play/raw/04-assistente.png', destino: 'tela-assistente-ia.jpg', formato: 'jpeg', contentType: 'image/jpeg' },
];

const raizProjeto = process.argv[2];
if (!raizProjeto) {
  console.error('Uso: node scripts/semear-marketing-brand-assets.mjs "<caminho da raiz do reef-system-app>"');
  process.exit(1);
}
if (!existsSync(raizProjeto)) {
  console.error(`Pasta não encontrada: ${raizProjeto}`);
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no seu próprio terminal antes de rodar este script ' +
    '(nunca como argumento de linha de comando).',
  );
  process.exit(1);
}

async function processarImagem(bufferOriginal, formato) {
  const pipeline = sharp(bufferOriginal).resize({
    width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true,
  });
  return formato === 'webp' ? pipeline.webp({ quality: 90 }).toBuffer() : pipeline.jpeg({ quality: 80 }).toBuffer();
}

async function subirParaStorage(destino, buffer, contentType) {
  const resposta = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${destino}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}: ${await resposta.text()}`);
}

const resultados = [];
for (const ativo of ATIVOS) {
  const caminhoOrigem = path.join(raizProjeto, ativo.origem);
  try {
    const bufferOriginal = await readFile(caminhoOrigem);
    const bufferFinal = await processarImagem(bufferOriginal, ativo.formato);
    await subirParaStorage(ativo.destino, bufferFinal, ativo.contentType);
    resultados.push({
      destino: ativo.destino,
      tamanhoOriginal: bufferOriginal.length,
      tamanhoFinal: bufferFinal.length,
      status: 'ok',
    });
  } catch (erro) {
    resultados.push({ destino: ativo.destino, status: 'erro', mensagem: erro.message });
  }
}

console.log(`\nBucket: ${BUCKET}\n`);
console.log('destino'.padEnd(26), 'original'.padStart(10), 'final'.padStart(10), 'reducao'.padStart(10));
let totalOriginal = 0;
let totalFinal = 0;
let algumErro = false;
for (const r of resultados) {
  if (r.status === 'erro') {
    console.log(`${r.destino.padEnd(26)} FALHOU: ${r.mensagem}`);
    algumErro = true;
    continue;
  }
  totalOriginal += r.tamanhoOriginal;
  totalFinal += r.tamanhoFinal;
  const reducao = `${Math.round((1 - r.tamanhoFinal / r.tamanhoOriginal) * 100)}%`;
  console.log(
    r.destino.padEnd(26),
    `${Math.round(r.tamanhoOriginal / 1024)} KB`.padStart(10),
    `${Math.round(r.tamanhoFinal / 1024)} KB`.padStart(10),
    reducao.padStart(10),
  );
}
console.log(`\nTotal: ${Math.round(totalOriginal / 1024)} KB -> ${Math.round(totalFinal / 1024)} KB`);

if (algumErro) process.exit(1);
