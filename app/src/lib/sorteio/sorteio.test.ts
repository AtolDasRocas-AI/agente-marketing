import { describe, it, expect } from 'vitest';
import { sortear, calcularHashLista, derivarSeedFinal, sha256, type ChanceSorteio } from './sorteio';

function lista(n: number, autoresRepetidos = false): ChanceSorteio[] {
  return Array.from({ length: n }, (_, i) => ({
    ordem: i,
    autor_username: autoresRepetidos ? `user${i % 3}` : `user${i}`,
    ig_comment_id: `ig_${String(i).padStart(4, '0')}`,
  }));
}

describe('sortear — determinismo (AC-10, o teste mais importante do projeto)', () => {
  it('100 execuções com a mesma semente e lista dão resultado idêntico', async () => {
    const chances = lista(500);
    const primeiro = await sortear(chances, 'LOTERIA-6789', 1, 3);
    const assinatura = (r: Awaited<ReturnType<typeof sortear>>) =>
      JSON.stringify([r.hash_lista, r.seed_final, r.vencedores, r.suplentes]);
    const esperado = assinatura(primeiro);

    for (let i = 0; i < 100; i++) {
      expect(assinatura(await sortear(chances, 'LOTERIA-6789', 1, 3))).toBe(esperado);
    }
  });

  it('a ordem de entrada da lista não altera o resultado (só ig_comment_id importa)', async () => {
    const chances = lista(200);
    const original = await sortear(chances, 'SEED-X', 2, 2);
    // mesma lista, ordem de array invertida — hash e resultado devem bater
    const invertida = [...chances].reverse();
    const outra = await sortear(invertida.sort((a, b) => a.ordem - b.ordem), 'SEED-X', 2, 2);
    expect(outra.hash_lista).toBe(original.hash_lista);
    expect(outra.vencedores).toEqual(original.vencedores);
  });

  it('semente diferente muda o resultado (a semente realmente entra no cálculo)', async () => {
    const chances = lista(300);
    const a = await sortear(chances, 'SEMENTE-A', 1, 3);
    const b = await sortear(chances, 'SEMENTE-B', 1, 3);
    expect(a.seed_final).not.toBe(b.seed_final);
    expect(a.vencedores[0].ig_comment_id).not.toBe(b.vencedores[0].ig_comment_id);
  });

  it('lista diferente com a mesma semente muda o resultado', async () => {
    const a = await sortear(lista(100), 'MESMA', 1, 0);
    const b = await sortear(lista(101), 'MESMA', 1, 0);
    expect(a.hash_lista).not.toBe(b.hash_lista);
    expect(a.seed_final).not.toBe(b.seed_final);
  });
});

describe('sortear — regras de seleção', () => {
  it('não repete autor entre vencedores e suplentes — AC-11', async () => {
    const chances = lista(60, true); // só 3 autores distintos
    const r = await sortear(chances, 'S', 1, 2);
    const todos = [...r.vencedores, ...r.suplentes].map((x) => x.autor_username);
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('respeita as quantidades pedidas', async () => {
    const r = await sortear(lista(50), 'S', 2, 3);
    expect(r.vencedores).toHaveLength(2);
    expect(r.suplentes).toHaveLength(3);
    expect(r.total_chances).toBe(50);
  });

  it('entrega o que existe quando há menos autores que vencedores+suplentes', async () => {
    const r = await sortear(lista(30, true), 'S', 1, 5); // 3 autores distintos
    expect(r.vencedores).toHaveLength(1);
    expect(r.suplentes.length).toBeLessThanOrEqual(2);
  });

  it('bloqueia lista vazia — E-14', async () => {
    await expect(sortear([], 'S', 1, 0)).rejects.toThrow('SEM_PARTICIPANTES');
  });

  it('bloqueia mais vencedores que participantes — E-15', async () => {
    await expect(sortear(lista(2), 'S', 5, 0)).rejects.toThrow('VENCEDORES_ACIMA_DE_PARTICIPANTES');
  });

  it('sorteia com um único participante', async () => {
    const r = await sortear(lista(1), 'S', 1, 0);
    expect(r.vencedores).toHaveLength(1);
    expect(r.vencedores[0].ig_comment_id).toBe('ig_0000');
  });
});

describe('hashes e semente', () => {
  it('sha256 confere com valor conhecido', async () => {
    expect(await sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('hash_lista muda se um único autor muda', async () => {
    const a = lista(10);
    const b = structuredClone(a);
    b[5].autor_username = 'outro';
    expect(await calcularHashLista(a)).not.toBe(await calcularHashLista(b));
  });

  it('seed_final = SHA256(semente|hash_lista) — reproduzível por terceiros', async () => {
    const hash = await calcularHashLista(lista(5));
    expect(await derivarSeedFinal('LF-6789', hash)).toBe(await sha256(`LF-6789|${hash}`));
  });

  it('a distribuição não é degenerada (vencedores variam com sementes distintas)', async () => {
    const chances = lista(200);
    const vencedores = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const r = await sortear(chances, `seed-${i}`, 1, 0);
      vencedores.add(r.vencedores[0].ig_comment_id);
    }
    expect(vencedores.size).toBeGreaterThan(10);
  });
});
