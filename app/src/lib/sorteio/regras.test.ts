import { describe, it, expect } from 'vitest';
import {
  extrairMencoes, classificar, montarChances, contemPalavraChave,
  type ComentarioEntrada, type RegrasSorteio,
} from './regras';

const ORG = 'atol.ia.oficial';

const regrasBase: RegrasSorteio = {
  organizador: ORG,
  modo: 'POR_PESSOA',
  mencoes_minimas: 1,
  teto_mencoes: 10,
};

function c(
  id: string,
  autor: string | null,
  texto: string,
  publicado = '2026-08-10T12:00:00Z',
  extra: Partial<ComentarioEntrada> = {}
): ComentarioEntrada {
  return { id, ig_comment_id: `ig_${id}`, autor_username: autor, texto, publicado_em: publicado, ...extra };
}

describe('extrairMencoes', () => {
  it('dedupe de menção repetida — E-02', () => {
    expect(extrairMencoes('@joao @joao', 'maria', ORG)).toEqual(['joao']);
  });

  it('descarta autoreferência — E-03', () => {
    expect(extrairMencoes('@maria @joao', 'maria', ORG)).toEqual(['joao']);
  });

  it('descarta menção ao organizador — E-04', () => {
    expect(extrairMencoes(`@${ORG} @joao`, 'maria', ORG)).toEqual(['joao']);
  });

  it('aceita handle inexistente — E-05', () => {
    expect(extrairMencoes('@conta_que_nao_existe_9', 'maria', ORG)).toEqual(['conta_que_nao_existe_9']);
  });

  it('remove ponto final colado e normaliza caixa', () => {
    expect(extrairMencoes('@Joao. vem!', 'maria', ORG)).toEqual(['joao']);
  });

  it('devolve vazio sem menções', () => {
    expect(extrairMencoes('quero participar!', 'maria', ORG)).toEqual([]);
  });
});

describe('classificar', () => {
  it('desqualifica sem menções — E-01/AC-06', () => {
    const [r] = classificar([c('1', 'maria', 'eu quero')], regrasBase);
    expect(r).toMatchObject({ status: 'DESQUALIFICADO', motivo: 'MENCOES_INSUFICIENTES' });
  });

  it('habilita com 1 menção (padrão da Rodada 1)', () => {
    const [r] = classificar([c('1', 'maria', '@joao')], regrasBase);
    expect(r.status).toBe('HABILITADO');
    expect(r.mencoes_validas).toBe(1);
  });

  it('exige 2 menções quando configurado — AC-06', () => {
    const regras = { ...regrasBase, mencoes_minimas: 2 };
    expect(classificar([c('1', 'maria', '@a @b')], regras)[0].status).toBe('HABILITADO');
    expect(classificar([c('2', 'maria', '@a')], regras)[0].motivo).toBe('MENCOES_INSUFICIENTES');
  });

  it('POR_PESSOA: 5 comentários = 1 chance — E-06/AC-07', () => {
    const comentarios = Array.from({ length: 5 }, (_, i) =>
      c(String(i), 'maria', `@amigo${i}`, `2026-08-10T12:0${i}:00Z`)
    );
    const r = classificar(comentarios, regrasBase);
    expect(r.filter((x) => x.status === 'HABILITADO')).toHaveLength(1);
    expect(r.filter((x) => x.motivo === 'DUPLICADO')).toHaveLength(4);
    expect(montarChances(r)).toHaveLength(1);
  });

  it('POR_COMENTARIO teto 3: 5 comentários = 3 chances — E-07/AC-08', () => {
    const regras: RegrasSorteio = { ...regrasBase, modo: 'POR_COMENTARIO', teto_chances: 3 };
    const comentarios = Array.from({ length: 5 }, (_, i) =>
      c(String(i), 'maria', `@amigo${i}`, `2026-08-10T12:0${i}:00Z`)
    );
    const r = classificar(comentarios, regras);
    expect(montarChances(r)).toHaveLength(3);
    expect(r.filter((x) => x.motivo === 'TETO_EXCEDIDO')).toHaveLength(2);
  });

  it('desqualifica comentário do organizador — E-09', () => {
    const [r] = classificar([c('1', ORG, '@joao')], regrasBase);
    expect(r.motivo).toBe('AUTOR_ORGANIZADOR');
  });

  it('desqualifica reply por padrão — E-10 / P-01', () => {
    const [r] = classificar([c('1', 'maria', '@joao', '2026-08-10T12:00:00Z', { is_reply: true })], regrasBase);
    expect(r.motivo).toBe('IGNORADO_REPLY');
  });

  it('reply concorre quando incluir_respostas está ligado', () => {
    const [r] = classificar(
      [c('1', 'maria', '@joao', '2026-08-10T12:00:00Z', { is_reply: true })],
      { ...regrasBase, incluir_respostas: true }
    );
    expect(r.status).toBe('HABILITADO');
    expect(montarChances([r])).toHaveLength(1);
  });

  it('com respostas ligadas, a regra de 1 chance por pessoa continua valendo', () => {
    // a pessoa comentou e também respondeu — segue com 1 chance só
    const r = classificar(
      [
        c('1', 'maria', '@joao', '2026-08-10T12:00:00Z'),
        c('2', 'maria', '@ana', '2026-08-10T12:05:00Z', { is_reply: true }),
      ],
      { ...regrasBase, incluir_respostas: true }
    );
    expect(montarChances(r)).toHaveLength(1);
    expect(r.filter((x) => x.status === 'EXTRA')).toHaveLength(1);
  });

  it('desqualifica autor sem username — E-13', () => {
    const [r] = classificar([c('1', null, '@joao')], regrasBase);
    expect(r.motivo).toBe('USUARIO_INDISPONIVEL');
  });

  it('desqualifica fora da janela — E-08', () => {
    const regras = { ...regrasBase, janela_inicio: '2026-08-05T00:00:00Z', janela_fim: '2026-08-09T23:59:59Z' };
    const [r] = classificar([c('1', 'maria', '@joao', '2026-08-10T12:00:00Z')], regras);
    expect(r.motivo).toBe('FORA_DA_JANELA');
  });

  it('heurísticas anti-bot vêm DESLIGADAS por padrão — ninguém é marcado suspeito', () => {
    const texto = Array.from({ length: 12 }, (_, i) => `@amigo${i}`).join(' ');
    const [r] = classificar([c('1', 'maria', texto)], regrasBase);
    expect(r.status).toBe('HABILITADO');
    expect(r.flags).toEqual([]);
  });

  it('flag EXCESSO_MENCOES só aparece com marcar_suspeitos ligado', () => {
    const texto = Array.from({ length: 12 }, (_, i) => `@amigo${i}`).join(' ');
    const [r] = classificar([c('1', 'maria', texto)], { ...regrasBase, marcar_suspeitos: true });
    expect(r.status).toBe('SUSPEITO');
    expect(r.flags).toContain('EXCESSO_MENCOES');
    expect(montarChances([r])).toHaveLength(1); // suspeito continua concorrendo
  });

  it('flag TEXTO_CLONADO com 3+ autores idênticos (quando ligado)', () => {
    const r = classificar(
      ['ana', 'bia', 'cid'].map((a, i) => c(String(i), a, 'bora @amigo', `2026-08-10T12:0${i}:00Z`)),
      { ...regrasBase, marcar_suspeitos: true }
    );
    expect(r.every((x) => x.flags.includes('TEXTO_CLONADO'))).toBe(true);
  });

  it('flag RAJADA em intervalo sub-humano do mesmo autor (quando ligado)', () => {
    const r = classificar(
      [
        c('1', 'maria', '@a', '2026-08-10T12:00:00Z'),
        c('2', 'maria', '@b', '2026-08-10T12:00:01Z'),
      ],
      { ...regrasBase, modo: 'POR_COMENTARIO', teto_chances: 5, marcar_suspeitos: true }
    );
    expect(r[1].flags).toContain('RAJADA');
  });
});

describe('comentários extras não eliminam a pessoa', () => {
  it('comentar 10 vezes dá 1 chance e os extras ficam EXTRA (não DESQUALIFICADO)', () => {
    const comentarios = Array.from({ length: 10 }, (_, i) =>
      c(String(i), 'maria', `@amigo${i}`, `2026-08-10T12:${String(i).padStart(2, '0')}:00Z`)
    );
    const r = classificar(comentarios, regrasBase);

    expect(r.filter((x) => x.status === 'HABILITADO')).toHaveLength(1);
    expect(r.filter((x) => x.status === 'EXTRA')).toHaveLength(9);
    expect(r.filter((x) => x.status === 'DESQUALIFICADO')).toHaveLength(0);
    expect(montarChances(r)).toHaveLength(1);
  });

  it('no modo POR_COMENTARIO os extras acima do teto também são EXTRA', () => {
    const regras: RegrasSorteio = { ...regrasBase, modo: 'POR_COMENTARIO', teto_chances: 3 };
    const comentarios = Array.from({ length: 5 }, (_, i) =>
      c(String(i), 'maria', `@amigo${i}`, `2026-08-10T12:0${i}:00Z`)
    );
    const r = classificar(comentarios, regras);
    expect(montarChances(r)).toHaveLength(3);
    expect(r.filter((x) => x.status === 'EXTRA')).toHaveLength(2);
    expect(r.filter((x) => x.motivo === 'TETO_EXCEDIDO')).toHaveLength(2);
  });

  it('quem não atende às regras continua DESQUALIFICADO', () => {
    const r = classificar([c('1', 'maria', 'sem mencao nenhuma')], regrasBase);
    expect(r[0].status).toBe('DESQUALIFICADO');
  });
});

describe('palavra/hashtag obrigatória', () => {
  it('regra desativada aceita qualquer texto', () => {
    expect(contemPalavraChave('@joao', null)).toBe(true);
    expect(contemPalavraChave('@joao', '')).toBe(true);
    expect(contemPalavraChave('@joao', '   ')).toBe(true);
  });

  it('ignora caixa e acento', () => {
    expect(contemPalavraChave('EU QUERO esse reef @joao', 'eu quero')).toBe(true);
    expect(contemPalavraChave('participacao @joao', 'participação')).toBe(true);
    expect(contemPalavraChave('#AtolReef @joao', '#atolreef')).toBe(true);
  });

  it('recusa quando falta a palavra', () => {
    expect(contemPalavraChave('quero sim @joao', 'eu quero')).toBe(false);
  });

  it('habilita só quem escreveu a palavra exigida', () => {
    const regras: RegrasSorteio = { ...regrasBase, palavra_chave: 'EU QUERO' };
    const r = classificar(
      [
        c('1', 'ana', 'eu quero @joao', '2026-08-10T12:00:00Z'),
        c('2', 'bia', 'me escolhe @joao', '2026-08-10T12:01:00Z'),
      ],
      regras
    );
    expect(r[0].status).toBe('HABILITADO');
    expect(r[1]).toMatchObject({ status: 'DESQUALIFICADO', motivo: 'PALAVRA_AUSENTE' });
    expect(montarChances(r)).toHaveLength(1);
  });

  it('a regra de menções tem precedência sobre a palavra-chave', () => {
    const regras: RegrasSorteio = { ...regrasBase, mencoes_minimas: 1, palavra_chave: 'eu quero' };
    const [r] = classificar([c('1', 'ana', 'eu quero!')], regras); // tem palavra, sem menção
    expect(r.motivo).toBe('MENCOES_INSUFICIENTES');
  });
});

describe('múltiplos vencedores (1º, 2º, 3º lugar)', () => {
  it('a ordem de saída do sorteio é a classificação', () => {
    // documenta a semântica: vencedores[0] = 1º, vencedores[1] = 2º, ...
    const r = classificar(
      Array.from({ length: 10 }, (_, i) =>
        c(String(i), `user${i}`, '@amigo', `2026-08-10T12:${String(i).padStart(2, '0')}:00Z`)
      ),
      regrasBase
    );
    expect(montarChances(r)).toHaveLength(10);
  });
});

describe('montarChances', () => {
  it('ordena por ig_comment_id, não pela ordem de entrada (determinismo)', () => {
    const classificacoes = classificar(
      [
        c('z', 'ana', '@x', '2026-08-10T12:00:00Z'),
        c('a', 'bia', '@y', '2026-08-10T12:01:00Z'),
      ],
      regrasBase
    );
    const chances = montarChances(classificacoes);
    expect(chances.map((x) => x.ig_comment_id)).toEqual(['ig_a', 'ig_z']);
    expect(chances.map((x) => x.ordem)).toEqual([0, 1]);
  });

  it('exclui desqualificados', () => {
    const r = classificar([c('1', 'maria', 'sem mencao'), c('2', 'ana', '@joao')], regrasBase);
    expect(montarChances(r)).toHaveLength(1);
  });
});
