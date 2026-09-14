import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sortear, type ChanceSorteio } from './sorteio';

/**
 * Garante que o verificador público standalone reproduz exatamente o
 * resultado do motor do app. Se este teste falha, o comprovante deixa
 * de ser verificável por terceiros — é o coração do RNF-01.
 */
describe('verificador público reproduz o motor do app', () => {
  it('mesma lista + mesma semente → mesmos vencedores e mesmo hash', async () => {
    const chances: ChanceSorteio[] = Array.from({ length: 120 }, (_, i) => ({
      ordem: i,
      autor_username: `participante${i}`,
      ig_comment_id: `ig_${String(i).padStart(4, '0')}`,
    }));
    const semente = 'STORIES-21-08-2026';

    const esperado = await sortear(chances, semente, 2, 3);

    const csv = join(tmpdir(), `chances-${Date.now()}.csv`);
    writeFileSync(
      csv,
      'ordem,autor_username,ig_comment_id\n' +
        chances.map((c) => `${c.ordem},${c.autor_username},${c.ig_comment_id}`).join('\n')
    );

    try {
      const saida = execFileSync(
        process.execPath,
        ['../verificador/verificar.mjs', csv, semente, '2', '3'],
        { encoding: 'utf8' }
      );

      expect(saida).toContain(esperado.hash_lista);
      expect(saida).toContain(esperado.seed_final);
      for (const v of esperado.vencedores) expect(saida).toContain(`@${v.autor_username}`);
      for (const s of esperado.suplentes) expect(saida).toContain(`@${s.autor_username}`);
    } finally {
      rmSync(csv, { force: true });
    }
  });
});
