/**
 * Copia os motores puros do app para supabase/functions/_shared.
 *
 * As Edge Functions (Deno) não compartilham o bundle do front, então o
 * código precisa existir nos dois lugares. A fonte da verdade é sempre
 * app/src/lib/sorteio/**. O teste `motores-sincronizados.test.ts` falha
 * se alguém editar a cópia em vez do original.
 *
 *   node scripts/sincronizar-motores.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEM = join(RAIZ, 'app', 'src', 'lib', 'sorteio');
const DESTINO = join(RAIZ, 'supabase', 'functions', '_shared');

export const ARQUIVOS = ['motivos.ts', 'regras.ts', 'sorteio.ts'];

const AVISO =
  '// ╔══════════════════════════════════════════════════════════════╗\n' +
  '// ║ ARQUIVO GERADO — não edite aqui.                             ║\n' +
  '// ║ Fonte: app/src/lib/sorteio/{nome}                            ║\n' +
  '// ║ Atualize com: node scripts/sincronizar-motores.mjs           ║\n' +
  '// ╚══════════════════════════════════════════════════════════════╝\n\n';

export function conteudoEsperado(nome) {
  return AVISO.replace('{nome}', nome.padEnd(28)) + readFileSync(join(ORIGEM, nome), 'utf8');
}

export function sincronizar() {
  mkdirSync(DESTINO, { recursive: true });
  for (const nome of ARQUIVOS) {
    writeFileSync(join(DESTINO, nome), conteudoEsperado(nome));
    console.log(`✅ ${nome} → supabase/functions/_shared/`);
  }
}

// executado direto (node scripts/sincronizar-motores.mjs), não importado
const invocadoDireto =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invocadoDireto) sincronizar();
