// ╔══════════════════════════════════════════════════════════════╗
// ║ ARQUIVO GERADO — não edite aqui.                             ║
// ║ Fonte: app/src/lib/sorteio/sorteio.ts                                              ║
// ║ Atualize com: node scripts/sincronizar-motores.mjs           ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Motor de sorteio — PURO e DETERMINÍSTICO (RNF-01).
 * Determinismo é o produto: mesma semente + mesma lista = mesmo resultado.
 * Sem Math.random() em nenhuma circunstância.
 */
// ─────────────────────────────────────────────────────────────
// PRNG xoshiro128** — implementado inline de propósito:
// zero dependências, roda idêntico no browser, no Deno (Edge
// Function) e no verificador público, e não pode quebrar por
// mudança de versão de biblioteca. Math.random() é proibido aqui.
// ─────────────────────────────────────────────────────────────
const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

/** Gerador determinístico a partir de 4 palavras de 32 bits */
export function criarGerador(s0: number, s1: number, s2: number, s3: number) {
  let a = s0 >>> 0, b = s1 >>> 0, c = s2 >>> 0, d = s3 >>> 0;
  if ((a | b | c | d) === 0) a = 1; // estado todo-zero é inválido

  /** próximo uint32 */
  function proximo(): number {
    const resultado = Math.imul(rotl(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
    const t = (b << 9) >>> 0;
    c = (c ^ a) >>> 0;
    d = (d ^ b) >>> 0;
    b = (b ^ c) >>> 0;
    a = (a ^ d) >>> 0;
    c = (c ^ t) >>> 0;
    d = rotl(d, 11);
    return resultado;
  }

  /** inteiro uniforme em [0, max] — rejection sampling, sem viés de módulo */
  function inteiroAte(max: number): number {
    const alcance = max + 1;
    if (alcance <= 1) return 0;
    let mascara = alcance - 1;
    mascara |= mascara >>> 1;
    mascara |= mascara >>> 2;
    mascara |= mascara >>> 4;
    mascara |= mascara >>> 8;
    mascara |= mascara >>> 16;
    let v: number;
    do {
      v = proximo() & mascara;
    } while (v >= alcance);
    return v;
  }

  return { proximo, inteiroAte };
}

export interface ChanceSorteio {
  ordem: number;
  autor_username: string;
  ig_comment_id: string;
}

export interface ResultadoSorteio {
  hash_lista: string;
  seed_final: string;
  vencedores: ChanceSorteio[];
  suplentes: ChanceSorteio[];
  total_chances: number;
}

/** SHA-256 hex — Web Crypto, funciona no browser, no Deno e no Node 18+ */
export async function sha256(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash da lista de participantes (AC-14).
 * Uma linha por chance: `ordem:autor:ig_comment_id`.
 * A lista precisa vir ordenada por ig_comment_id (ver montarChances).
 */
export async function calcularHashLista(chances: ChanceSorteio[]): Promise<string> {
  const linhas = chances.map((c) => `${c.ordem}:${c.autor_username}:${c.ig_comment_id}`);
  return sha256(linhas.join('\n'));
}

/**
 * Deriva a semente final. É o passo que impede manipulação: a semente
 * depende do hash da lista congelada, então não se pode escolher uma
 * semente que favoreça alguém antes de fechar o snapshot.
 */
export async function derivarSeedFinal(seedPublica: string, hashLista: string): Promise<string> {
  return sha256(`${seedPublica}|${hashLista}`);
}

/** Deriva 128 bits de estado (4 palavras) dos primeiros 32 hex do seed_final */
export function seedParaEstado(seedFinal: string): [number, number, number, number] {
  const palavra = (i: number) => parseInt(seedFinal.slice(i * 8, i * 8 + 8), 16) >>> 0;
  return [palavra(0), palavra(1), palavra(2), palavra(3)];
}

/**
 * Executa o sorteio.
 * Fisher-Yates parcial com dedupe por autor (AC-11: vencedores e
 * suplentes nunca repetem a mesma pessoa).
 */
export async function sortear(
  chances: ChanceSorteio[],
  seedPublica: string,
  qtdVencedores: number,
  qtdSuplentes: number
): Promise<ResultadoSorteio> {
  if (chances.length === 0) {
    throw new Error('SEM_PARTICIPANTES'); // E-14
  }
  const autoresDistintos = new Set(chances.map((c) => c.autor_username)).size;
  if (qtdVencedores > autoresDistintos) {
    throw new Error('VENCEDORES_ACIMA_DE_PARTICIPANTES'); // E-15
  }

  const hashLista = await calcularHashLista(chances);
  const seedFinal = await derivarSeedFinal(seedPublica, hashLista);

  const rng = criarGerador(...seedParaEstado(seedFinal));
  const pool = [...chances];
  const sorteados: ChanceSorteio[] = [];
  const autoresJaSorteados = new Set<string>();
  const desejado = qtdVencedores + qtdSuplentes;

  // Embaralha do fim para o início, coletando autores distintos
  for (let i = pool.length - 1; i > 0 && sorteados.length < desejado; i--) {
    const j = rng.inteiroAte(i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
    if (!autoresJaSorteados.has(pool[i].autor_username)) {
      autoresJaSorteados.add(pool[i].autor_username);
      sorteados.push(pool[i]);
    }
  }
  // pool[0] é o único índice que o laço não visita
  if (sorteados.length < desejado && !autoresJaSorteados.has(pool[0].autor_username)) {
    autoresJaSorteados.add(pool[0].autor_username);
    sorteados.push(pool[0]);
  }

  return {
    hash_lista: hashLista,
    seed_final: seedFinal,
    vencedores: sorteados.slice(0, qtdVencedores),
    suplentes: sorteados.slice(qtdVencedores),
    total_chances: chances.length,
  };
}
