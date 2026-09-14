import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * As Edge Functions (Deno) precisam de uma cópia dos motores puros —
 * elas não compartilham o bundle do front. Este teste falha se alguém
 * editar a cópia em vez do original, ou esquecer de rodar
 * `node scripts/sincronizar-motores.mjs` depois de mudar as regras.
 *
 * Sem isso, o app e o servidor poderiam sortear resultados diferentes.
 */
const RAIZ = join(process.cwd(), '..');
const ORIGEM = join(RAIZ, 'app', 'src', 'lib', 'sorteio');
const COPIA = join(RAIZ, 'supabase', 'functions', '_shared');

describe('motores do app e das Edge Functions estão sincronizados', () => {
  for (const nome of ['motivos.ts', 'regras.ts', 'sorteio.ts']) {
    it(nome, () => {
      const original = readFileSync(join(ORIGEM, nome), 'utf8');
      const copia = readFileSync(join(COPIA, nome), 'utf8');
      // a cópia leva um cabeçalho de aviso; o corpo precisa ser idêntico
      const corpo = copia.slice(copia.indexOf('╚') > -1 ? copia.indexOf('\n\n') + 2 : 0);
      expect(corpo).toBe(original);
    });
  }
});
