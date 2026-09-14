#!/usr/bin/env node
/**
 * VERIFICADOR PÚBLICO DO SORTEIO — Sorteio ATOL
 *
 * Qualquer pessoa pode recalcular o resultado a partir do CSV de
 * participantes e da semente publicada. Zero dependências.
 *
 *   node verificar.mjs participantes.csv "SEMENTE-PUBLICADA" [vencedores] [suplentes]
 *
 * O CSV precisa ter as colunas: ordem,autor_username,ig_comment_id
 * (é exatamente o que o app exporta na tela de comprovante).
 *
 * Este arquivo é uma cópia autocontida do motor em
 * app/src/lib/sorteio/sorteio.ts — mesma lógica, mesmo resultado.
 */
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const crypto = globalThis.crypto ?? webcrypto;

// ── SHA-256 ──
async function sha256(texto) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── PRNG xoshiro128** ──
const rotl = (x, k) => ((x << k) | (x >>> (32 - k))) >>> 0;

function criarGerador(s0, s1, s2, s3) {
  let a = s0 >>> 0, b = s1 >>> 0, c = s2 >>> 0, d = s3 >>> 0;
  if ((a | b | c | d) === 0) a = 1;
  const proximo = () => {
    const resultado = Math.imul(rotl(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
    const t = (b << 9) >>> 0;
    c = (c ^ a) >>> 0; d = (d ^ b) >>> 0; b = (b ^ c) >>> 0;
    a = (a ^ d) >>> 0; c = (c ^ t) >>> 0; d = rotl(d, 11);
    return resultado;
  };
  const inteiroAte = (max) => {
    const alcance = max + 1;
    if (alcance <= 1) return 0;
    let m = alcance - 1;
    m |= m >>> 1; m |= m >>> 2; m |= m >>> 4; m |= m >>> 8; m |= m >>> 16;
    let v;
    do { v = proximo() & m; } while (v >= alcance);
    return v;
  };
  return { inteiroAte };
}

// ── CSV → chances ──
function lerCsv(caminho) {
  const linhas = readFileSync(caminho, 'utf8').trim().split(/\r?\n/);
  const cabecalho = linhas[0].split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
  const idx = (nome) => cabecalho.indexOf(nome);
  const iOrdem = idx('ordem'), iAutor = idx('autor_username'), iId = idx('ig_comment_id');
  if (iOrdem < 0 || iAutor < 0 || iId < 0) {
    console.error('❌ CSV precisa das colunas: ordem,autor_username,ig_comment_id');
    process.exit(1);
  }
  return linhas.slice(1).filter(Boolean).map((linha) => {
    const col = linha.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
    return { ordem: Number(col[iOrdem]), autor_username: col[iAutor], ig_comment_id: col[iId] };
  });
}

// ── main ──
const [caminho, seedPublica, nVenc = '1', nSup = '3'] = process.argv.slice(2);
if (!caminho || !seedPublica) {
  console.log('Uso: node verificar.mjs <participantes.csv> "<semente>" [vencedores] [suplentes]');
  process.exit(1);
}

const chances = lerCsv(caminho).sort((a, b) => a.ig_comment_id.localeCompare(b.ig_comment_id));
const hashLista = await sha256(
  chances.map((c) => `${c.ordem}:${c.autor_username}:${c.ig_comment_id}`).join('\n')
);
const seedFinal = await sha256(`${seedPublica}|${hashLista}`);
const estado = [0, 1, 2, 3].map((i) => parseInt(seedFinal.slice(i * 8, i * 8 + 8), 16) >>> 0);
const rng = criarGerador(...estado);

const pool = [...chances];
const sorteados = [];
const vistos = new Set();
const desejado = Number(nVenc) + Number(nSup);
for (let i = pool.length - 1; i > 0 && sorteados.length < desejado; i--) {
  const j = rng.inteiroAte(i);
  [pool[i], pool[j]] = [pool[j], pool[i]];
  if (!vistos.has(pool[i].autor_username)) {
    vistos.add(pool[i].autor_username);
    sorteados.push(pool[i]);
  }
}
if (sorteados.length < desejado && !vistos.has(pool[0].autor_username)) sorteados.push(pool[0]);

console.log('\n══════ VERIFICAÇÃO DO SORTEIO ══════');
console.log(`participantes (chances): ${chances.length}`);
console.log(`semente publicada:       ${seedPublica}`);
console.log(`hash_lista  (SHA-256):   ${hashLista}`);
console.log(`seed_final  (SHA-256):   ${seedFinal}`);
console.log('\n🏆 VENCEDORES');
sorteados.slice(0, Number(nVenc)).forEach((v, i) => console.log(`  ${i + 1}. @${v.autor_username}`));
console.log('\n🎗️  SUPLENTES');
sorteados.slice(Number(nVenc)).forEach((v, i) => console.log(`  ${i + 1}. @${v.autor_username}`));
console.log('\nCompare estes valores com o comprovante publicado.');
console.log('Se hash_lista e vencedores coincidirem, o sorteio é legítimo.\n');
