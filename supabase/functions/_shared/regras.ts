// ╔══════════════════════════════════════════════════════════════╗
// ║ ARQUIVO GERADO — não edite aqui.                             ║
// ║ Fonte: app/src/lib/sorteio/regras.ts                                               ║
// ║ Atualize com: node scripts/sincronizar-motores.mjs           ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Motor de regras — PURO (sem I/O, sem Supabase).
 * Reusado pela Edge Function de processamento e pelo verificador público.
 */
import type { FlagSuspeita, Motivo } from './motivos';

// Handle do Instagram: letras, números, ponto e underscore, até 30 chars
const RE_MENCAO = /@([a-zA-Z0-9._]{1,30})/g;

/**
 * Extrai menções válidas de um comentário.
 * E-02: `@joao @joao` conta 1 · E-03: autor descartado · E-04: organizador descartado
 */
export function extrairMencoes(texto: string, autor: string, organizador: string): string[] {
  const brutas = [...(texto ?? '').matchAll(RE_MENCAO)].map((m) =>
    m[1].toLowerCase().replace(/\.+$/, '') // remove ponto final colado
  );
  const autorLc = (autor ?? '').toLowerCase();
  const orgLc = (organizador ?? '').toLowerCase();
  const validas = new Set(
    brutas.filter((h) => h.length > 0 && h !== autorLc && h !== orgLc)
  );
  return [...validas];
}

/** Total de menções escritas, incluindo repetidas (base da heurística anti-bot) */
export function contarMencoesBrutas(texto: string): number {
  return [...(texto ?? '').matchAll(RE_MENCAO)].length;
}

/** Remove acentos e caixa para comparar palavra obrigatória sem pegadinha */
export function normalizarParaBusca(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** O comentário contém a palavra/hashtag exigida? (regra opcional) */
export function contemPalavraChave(texto: string, palavraChave?: string | null): boolean {
  const exigida = normalizarParaBusca(palavraChave ?? '');
  if (!exigida) return true; // regra desativada
  return normalizarParaBusca(texto).includes(exigida);
}

/** Normaliza o texto para detectar clones entre autores distintos */
export function normalizarTexto(texto: string): string {
  return (texto ?? '')
    .toLowerCase()
    .replace(/@[\w.]+/g, '@')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ComentarioEntrada {
  id: string;
  ig_comment_id: string;
  autor_username: string | null;
  texto: string;
  publicado_em: string; // ISO
  is_reply?: boolean;
}

export interface RegrasSorteio {
  organizador: string;
  modo: 'POR_PESSOA' | 'POR_COMENTARIO';
  teto_chances?: number | null;
  mencoes_minimas: number;
  teto_mencoes: number;
  /** texto que o comentário precisa conter; null/vazio desativa a regra */
  palavra_chave?: string | null;
  /** liga as heurísticas anti-bot; padrão desligado (falso positivo gera briga) */
  marcar_suspeitos?: boolean;
  /** se verdadeiro, respostas a comentários também concorrem (padrão: só 1º nível) */
  incluir_respostas?: boolean;
  janela_inicio?: string | null;
  janela_fim?: string | null;
}

export interface Classificacao {
  comentario_id: string;
  ig_comment_id: string;
  autor_username: string | null;
  /**
   * HABILITADO    — concorre
   * EXTRA         — a pessoa já tem chance; este comentário não acumula
   *                 (ela NÃO foi eliminada)
   * DESQUALIFICADO— não atende às regras
   * SUSPEITO      — concorre, mas com flag anti-bot (opcional)
   */
  status: 'HABILITADO' | 'EXTRA' | 'DESQUALIFICADO' | 'SUSPEITO';
  motivo: Motivo | null;
  flags: FlagSuspeita[];
  mencoes_validas: number;
}

/**
 * Classifica todos os comentários do snapshot.
 * A ordem das regras importa: a primeira que bate define o motivo.
 * Processa em ordem cronológica estável (publicado_em, ig_comment_id).
 */
export function classificar(
  comentarios: ComentarioEntrada[],
  regras: RegrasSorteio
): Classificacao[] {
  const ordenados = [...comentarios].sort((a, b) => {
    const t = a.publicado_em.localeCompare(b.publicado_em);
    return t !== 0 ? t : a.ig_comment_id.localeCompare(b.ig_comment_id);
  });

  // pré-cálculo: autores distintos por texto normalizado (TEXTO_CLONADO)
  const autoresPorTexto = new Map<string, Set<string>>();
  for (const c of ordenados) {
    if (!c.autor_username) continue;
    const chave = normalizarTexto(c.texto);
    if (!chave) continue;
    if (!autoresPorTexto.has(chave)) autoresPorTexto.set(chave, new Set());
    autoresPorTexto.get(chave)!.add(c.autor_username.toLowerCase());
  }

  const chancesPorAutor = new Map<string, number>();
  const ultimoInstantePorAutor = new Map<string, number>();
  const orgLc = (regras.organizador ?? '').toLowerCase();
  const teto =
    regras.modo === 'POR_COMENTARIO' ? Math.max(1, regras.teto_chances ?? 1) : 1;

  const saida: Classificacao[] = [];

  for (const c of ordenados) {
    const base = {
      comentario_id: c.id,
      ig_comment_id: c.ig_comment_id,
      autor_username: c.autor_username,
    };
    const autorLc = c.autor_username?.toLowerCase() ?? null;

    // 1. reply (E-10 / P-01) — participa só se o sorteio permitir
    if (c.is_reply && !regras.incluir_respostas) {
      saida.push({ ...base, status: 'DESQUALIFICADO', motivo: 'IGNORADO_REPLY', flags: [], mencoes_validas: 0 });
      continue;
    }
    // 2. organizador (E-09)
    if (autorLc && autorLc === orgLc) {
      saida.push({ ...base, status: 'DESQUALIFICADO', motivo: 'AUTOR_ORGANIZADOR', flags: [], mencoes_validas: 0 });
      continue;
    }
    // 3. usuário indisponível (E-13)
    if (!autorLc) {
      saida.push({ ...base, status: 'DESQUALIFICADO', motivo: 'USUARIO_INDISPONIVEL', flags: [], mencoes_validas: 0 });
      continue;
    }
    // 4. janela de datas (E-08)
    const instante = new Date(c.publicado_em).getTime();
    const inicioOk = !regras.janela_inicio || instante >= new Date(regras.janela_inicio).getTime();
    const fimOk = !regras.janela_fim || instante <= new Date(regras.janela_fim).getTime();
    if (!inicioOk || !fimOk) {
      saida.push({ ...base, status: 'DESQUALIFICADO', motivo: 'FORA_DA_JANELA', flags: [], mencoes_validas: 0 });
      continue;
    }
    // 5. menções mínimas (E-01)
    const mencoes = extrairMencoes(c.texto, c.autor_username!, regras.organizador);
    if (mencoes.length < regras.mencoes_minimas) {
      saida.push({
        ...base, status: 'DESQUALIFICADO', motivo: 'MENCOES_INSUFICIENTES',
        flags: [], mencoes_validas: mencoes.length,
      });
      continue;
    }

    // 6. palavra/hashtag obrigatória (regra opcional)
    if (!contemPalavraChave(c.texto, regras.palavra_chave)) {
      saida.push({
        ...base, status: 'DESQUALIFICADO', motivo: 'PALAVRA_AUSENTE',
        flags: [], mencoes_validas: mencoes.length,
      });
      continue;
    }

    // 7. heurísticas anti-bot — opcionais, desligadas por padrão
    const flags: FlagSuspeita[] = [];
    if (regras.marcar_suspeitos) {
      if (contarMencoesBrutas(c.texto) > regras.teto_mencoes) flags.push('EXCESSO_MENCOES');
      if ((autoresPorTexto.get(normalizarTexto(c.texto))?.size ?? 0) >= 3) flags.push('TEXTO_CLONADO');
      const anterior = ultimoInstantePorAutor.get(autorLc);
      if (anterior !== undefined && (instante - anterior) / 1000 < 3) flags.push('RAJADA');
    }
    ultimoInstantePorAutor.set(autorLc, instante);

    /* 8/9. comentário extra de quem já tem chance (E-06 / E-07).
       Status EXTRA, não DESQUALIFICADO: a pessoa segue concorrendo —
       ela pode comentar quantas vezes quiser, só não acumula chances. */
    const usadas = chancesPorAutor.get(autorLc) ?? 0;
    if (usadas >= teto) {
      saida.push({
        ...base,
        status: 'EXTRA',
        motivo: regras.modo === 'POR_PESSOA' ? 'DUPLICADO' : 'TETO_EXCEDIDO',
        flags,
        mencoes_validas: mencoes.length,
      });
      continue;
    }

    // 10. habilitado (SUSPEITO ainda concorre — decisão do plano técnico)
    chancesPorAutor.set(autorLc, usadas + 1);
    saida.push({
      ...base,
      status: flags.length ? 'SUSPEITO' : 'HABILITADO',
      motivo: flags.length ? 'SUSPEITO_AUTOMACAO' : null,
      flags,
      mencoes_validas: mencoes.length,
    });
  }

  return saida;
}

export interface Chance {
  ordem: number;
  autor_username: string;
  comentario_id: string;
  ig_comment_id: string;
}

/**
 * Materializa a lista de chances a partir das classificações.
 * Ordena por ig_comment_id (ordem vinda do Instagram, nunca do INSERT) —
 * é o que garante o determinismo do hash da lista.
 */
export function montarChances(classificacoes: Classificacao[]): Chance[] {
  return classificacoes
    .filter((c) => c.status === 'HABILITADO' || c.status === 'SUSPEITO')
    .sort((a, b) => a.ig_comment_id.localeCompare(b.ig_comment_id))
    .map((c, i) => ({
      ordem: i,
      autor_username: c.autor_username!,
      comentario_id: c.comentario_id,
      ig_comment_id: c.ig_comment_id,
    }));
}
