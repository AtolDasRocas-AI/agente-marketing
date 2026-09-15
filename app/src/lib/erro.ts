/**
 * Extrai uma mensagem legível de qualquer erro.
 *
 * `String(e)` produz "[object Object]" para erros do Supabase, que não são
 * instâncias de Error — são objetos simples (PostgrestError tem
 * {message, details, hint, code}; FunctionsHttpError guarda a resposta em
 * `context`). Sem isso o usuário vê "[object Object]" e perde a informação.
 */
export function mensagemDeErro(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error && e.message) return e.message;

  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;

    // PostgrestError e afins
    if (typeof o.message === 'string' && o.message) {
      const detalhe = typeof o.details === 'string' && o.details ? ` (${o.details})` : '';
      const dica = typeof o.hint === 'string' && o.hint ? ` — ${o.hint}` : '';
      return `${o.message}${detalhe}${dica}`;
    }
    // corpo { error: "..." } das Edge Functions
    if (typeof o.error === 'string' && o.error) return o.error;
    if (typeof o.error_description === 'string') return o.error_description;

    try {
      const json = JSON.stringify(o);
      if (json && json !== '{}') return json;
    } catch {
      /* objeto com referência circular */
    }
  }

  return 'Erro inesperado. Tente de novo.';
}

/** Erro de Edge Function: tenta ler a mensagem amigável do corpo da resposta */
export async function mensagemDeErroFuncao(e: unknown): Promise<string> {
  const contexto = (e as { context?: Response } | null)?.context;
  if (contexto && typeof contexto.json === 'function') {
    try {
      const corpo = await contexto.clone().json();
      // Edge Functions de Marketing usam {codigo, mensagem} em vez de {error}.
      if (corpo?.mensagem) return String(corpo.mensagem);
      if (corpo?.error) return String(corpo.error);
      if (corpo?.codigo) return String(corpo.codigo);
    } catch {
      try {
        const texto = await contexto.clone().text();
        if (texto) return texto.slice(0, 300);
      } catch {
        /* corpo já consumido */
      }
    }
  }
  return mensagemDeErro(e);
}
