import { exigirSupabase } from '../../lib/supabase';
import { mensagemDeErroFuncao } from '../../lib/erro';

export interface SorteioResumo {
  id: string;
  titulo: string;
  permalink: string | null;
  status: 'RASCUNHO' | 'IMPORTANDO' | 'PRONTO' | 'ENCERRADO' | 'SORTEADO';
  modo: 'POR_PESSOA' | 'POR_COMENTARIO';
  mencoes_minimas: number;
  qtd_vencedores: number;
  qtd_suplentes: number;
  seed_publica: string | null;
  hash_lista: string | null;
  criado_em: string;
}

export interface ParticipanteLinha {
  comentario_id: string;
  autor_username: string | null;
  texto: string;
  publicado_em: string;
  /** EXTRA = a pessoa participa, mas este comentário não acumula chance */
  status: 'HABILITADO' | 'EXTRA' | 'DESQUALIFICADO' | 'SUSPEITO';
  motivo: string | null;
  mencoes_validas: number;
}

export interface ResultadoPersistido {
  id: string;
  seed_publica: string;
  seed_fonte: string;
  hash_lista: string;
  total_comentarios: number;
  total_habilitados: number;
  total_chances: number;
  vencedores: Array<{ autor_username: string; ig_comment_id: string; ordem: number }>;
  suplentes: Array<{ autor_username: string; ig_comment_id: string; ordem: number }>;
  executado_em: string;
}

export interface MidiaInstagram {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  permalink: string;
  timestamp: string;
  comments_count: number;
  media_url?: string;
  thumbnail_url?: string;
  children?: {
    data?: Array<{ media_url?: string; thumbnail_url?: string; media_type?: string }>;
  };
}

/** Galeria de posts da conta conectada (CAP-03) */
export async function listarMidias(): Promise<{
  account_id: string;
  username: string;
  midias: MidiaInstagram[];
}> {
  const { data, error } = await exigirSupabase().functions.invoke('ig-list-media');
  if (error) throw new Error(await mensagemDeErroFuncao(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

export interface ContagemPost {
  /** comentários de 1º nível — é o que o `comments_count` da API reporta */
  nivel1: number;
  /** respostas, que o Instagram soma na contagem que você vê no app */
  respostas: number;
  total: number;
  truncado: boolean;
}

/** Contagem exata do post escolhido (só dele: na galeria inteira seria lento) */
export async function contarComentarios(igMediaId: string): Promise<ContagemPost> {
  const { data, error } = await exigirSupabase().functions.invoke('ig-contagem-post', {
    body: { ig_media_id: igMediaId },
  });
  if (error) throw new Error(await mensagemDeErroFuncao(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

export interface RegrasNovoSorteio {
  account_id: string;
  ig_media_id: string;
  permalink: string;
  titulo: string;
  modo: 'POR_PESSOA' | 'POR_COMENTARIO';
  teto_chances: number | null;
  mencoes_minimas: number;
  palavra_chave: string | null;
  marcar_suspeitos: boolean;
  incluir_respostas: boolean;
  qtd_vencedores: number;
  qtd_suplentes: number;
  janela_inicio: string | null;
  janela_fim: string | null;
}

/** Cria o sorteio (RLS garante que a conta é do organizador) */
export async function criarSorteio(regras: RegrasNovoSorteio): Promise<{ id: string }> {
  const { data, error } = await exigirSupabase()
    .from('sorteio')
    .insert({ ...regras, status: 'RASCUNHO' })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

/** Dispara a importação dos comentários do post escolhido */
export async function iniciarImportacao(sorteioId: string): Promise<{
  total_no_banco: number;
  concluido: boolean;
}> {
  const { data, error } = await exigirSupabase().functions.invoke('ig-import-comments', {
    body: { sorteio_id: sorteioId },
  });
  if (error) throw new Error(await mensagemDeErroFuncao(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Importa em lotes até terminar (a function processa ~500 por invocação) */
export async function importarTudo(
  sorteioId: string,
  aoProgresso?: (total: number) => void
): Promise<number> {
  for (let volta = 0; volta < 60; volta++) {
    const r = await iniciarImportacao(sorteioId);
    aoProgresso?.(r.total_no_banco);
    if (r.concluido) return r.total_no_banco;
  }
  throw new Error('Importação não concluiu em 60 lotes — verifique o job.');
}

/** Aplica o motor de regras e materializa as chances */
export async function processarRegras(sorteioId: string): Promise<{
  total_comentarios: number;
  resumo: Record<string, number>;
  total_chances: number;
  autores_distintos: number;
}> {
  const { data, error } = await exigirSupabase().functions.invoke('sorteio-processar', {
    body: { sorteio_id: sorteioId },
  });
  if (error) throw new Error(await mensagemDeErroFuncao(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Executa o sorteio com a semente publicada (append-only) */
export async function executarSorteio(
  sorteioId: string,
  seedPublica: string,
  seedFonte?: string
): Promise<ResultadoPersistido & { seed_final: string }> {
  const { data, error } = await exigirSupabase().functions.invoke('sorteio-executar', {
    body: { sorteio_id: sorteioId, seed_publica: seedPublica, seed_fonte: seedFonte },
  });
  // a function devolve mensagem amigável no corpo em 409/400
  if (error) throw new Error(await mensagemDeErroFuncao(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listarSorteios(): Promise<SorteioResumo[]> {
  const { data, error } = await exigirSupabase()
    .from('sorteio')
    .select('id, titulo, permalink, status, modo, mencoes_minimas, qtd_vencedores, qtd_suplentes, seed_publica, hash_lista, criado_em')
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function buscarSorteio(id: string): Promise<SorteioResumo | null> {
  const { data, error } = await exigirSupabase()
    .from('sorteio')
    .select('id, titulo, permalink, status, modo, mencoes_minimas, qtd_vencedores, qtd_suplentes, seed_publica, hash_lista, criado_em')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Participantes com status e motivo (tela Participantes) */
export async function listarParticipantes(sorteioId: string): Promise<ParticipanteLinha[]> {
  const { data, error } = await exigirSupabase()
    .from('qualificacao')
    .select('comentario_id, status, motivo, mencoes_validas, comentario(autor_username, texto, publicado_em)')
    .eq('sorteio_id', sorteioId)
    .order('processado_em', { ascending: true })
    .limit(5000);
  if (error) throw error;

  type Bruto = {
    comentario_id: string;
    status: ParticipanteLinha['status'];
    motivo: string | null;
    mencoes_validas: number;
    comentario: { autor_username: string | null; texto: string; publicado_em: string } | null;
  };

  return ((data ?? []) as unknown as Bruto[]).map((q) => ({
    comentario_id: q.comentario_id,
    status: q.status,
    motivo: q.motivo,
    mencoes_validas: q.mencoes_validas,
    autor_username: q.comentario?.autor_username ?? null,
    texto: q.comentario?.texto ?? '',
    publicado_em: q.comentario?.publicado_em ?? '',
  }));
}

/**
 * Apaga um sorteio e tudo que pende dele (comentários, qualificação,
 * chances e resultado) via cascade. Irreversível.
 */
export async function apagarSorteio(sorteioId: string): Promise<void> {
  const { error } = await exigirSupabase().from('sorteio').delete().eq('id', sorteioId);
  if (error) throw error;
}

/** Apaga vários de uma vez (limpeza dos testes) */
export async function apagarSorteios(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { error } = await exigirSupabase().from('sorteio').delete().in('id', ids);
  if (error) throw error;
  return ids.length;
}

export async function buscarResultado(sorteioId: string): Promise<ResultadoPersistido | null> {
  const { data, error } = await exigirSupabase()
    .from('resultado')
    .select('*')
    .eq('sorteio_id', sorteioId)
    .maybeSingle();
  if (error) throw error;
  return data as ResultadoPersistido | null;
}

/** Chances na urna — usado pela roleta e pela exportação CSV */
export async function listarChances(
  sorteioId: string
): Promise<Array<{ ordem: number; autor_username: string; ig_comment_id: string }>> {
  const { data, error } = await exigirSupabase()
    .from('chance')
    .select('ordem, autor_username, comentario(ig_comment_id)')
    .eq('sorteio_id', sorteioId)
    .order('ordem', { ascending: true })
    .limit(20000);
  if (error) throw error;

  type Bruto = { ordem: number; autor_username: string; comentario: { ig_comment_id: string } | null };
  return ((data ?? []) as unknown as Bruto[]).map((c) => ({
    ordem: c.ordem,
    autor_username: c.autor_username,
    ig_comment_id: c.comentario?.ig_comment_id ?? '',
  }));
}
