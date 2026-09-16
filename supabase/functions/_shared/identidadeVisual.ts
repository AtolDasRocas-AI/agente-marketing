// Referências visuais REAIS da marca ATOL (logo oficial, clima visual e telas do app
// real), usadas para ancorar a geração de imagem por IA em algo além de descrição em
// texto. Os 4 arquivos vivem no bucket privado `marketing-referencias-marca`
// (migration 0035) e são populados por `scripts/semear-marketing-brand-assets.mjs` a
// partir do projeto real do app (fora deste repo). Institucionais e fixos — não há
// nada por-workspace aqui.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET_REFERENCIAS_MARCA = 'marketing-referencias-marca';

// Dois grupos, e a separação importa. As referências BASE (logotipo + clima visual) são
// seguras em qualquer cena: carregam paleta, textura e motivo da marca, sem nenhuma
// estrutura que o modelo possa copiar por engano.
// Já as TELAS são screenshots completos do app (barra de status, header, navegação
// inferior) — anexá-las em toda geração fez o modelo copiar o *chrome do app* e desenhar
// a cena fotográfica dentro de uma moldura de aplicativo falsa. Por isso elas só entram
// quando o post é explicitamente sobre a tela do app.
const REFERENCIAS_BASE = [
  { caminho: 'logotipo-marca.webp', mime: 'image/webp' },
  { caminho: 'clima-visual-recife.jpg', mime: 'image/jpeg' },
] as const;

// Uma tela por função do app. O post escolhe quais são relevantes; anexar todas de uma vez
// só encheria o pedido de contexto irrelevante e confundiria o modelo.
export const TELAS_DO_APP = {
  DASHBOARD: { caminho: 'tela-dashboard.jpg', rotulo: 'Dashboard' },
  PARAMETROS: { caminho: 'tela-parametros.jpg', rotulo: 'Parâmetros da água' },
  ALERTAS: { caminho: 'tela-alertas.jpg', rotulo: 'Alertas' },
  ASSISTENTE_IA: { caminho: 'tela-assistente-ia.jpg', rotulo: 'Assistente de IA' },
  HABITANTES: { caminho: 'tela-habitantes.jpg', rotulo: 'Habitantes' },
  DIARIO: { caminho: 'tela-diario.jpg', rotulo: 'Diário' },
  REEF_VIRTUAL: { caminho: 'tela-reef-virtual.jpg', rotulo: 'Reef Virtual' },
  CRIAR_CONTEUDO: { caminho: 'tela-criar-conteudo.jpg', rotulo: 'Criar conteúdo' },
  ILUMINACAO: { caminho: 'tela-iluminacao.jpg', rotulo: 'Iluminação' },
  PROTOCOLOS: { caminho: 'tela-protocolos.jpg', rotulo: 'Protocolos' },
  CONFIGURACOES: { caminho: 'tela-configuracoes.jpg', rotulo: 'Configurações' },
} as const;

export type ChaveTelaDoApp = keyof typeof TELAS_DO_APP;

// Teto deliberado: mais do que isso vira ruído para o modelo e infla o payload de cada
// chamada — o comportamento com múltiplas imagens de referência já é pouco previsível.
const MAXIMO_TELAS_POR_PEDIDO = 2;

export type ConteudoImagemMensagem = { type: 'image_url'; image_url: { url: string } };

// Memoizado em escopo de módulo: estes arquivos só mudam por reseed manual (evento raro),
// e todo `supabase functions deploy` recicla o isolate e zera este cache — não vale a
// complexidade de um TTL para um asset que não muda em produção normal.
const cachePorCaminho = new Map<string, Promise<ConteudoImagemMensagem>>();

function paraBase64(bytes: Uint8Array): string {
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

export function referenciasDeMarcaHabilitadas(): boolean {
  return Deno.env.get('MARKETING_AI_IMAGE_BRAND_REFS_ENABLED') !== 'false';
}

function baixarReferencia(
  admin: ReturnType<typeof createClient>,
  caminho: string,
  mime: string,
): Promise<ConteudoImagemMensagem> {
  const emCache = cachePorCaminho.get(caminho);
  if (emCache) return emCache;
  const promessa = (async () => {
    const { data, error } = await admin.storage.from(BUCKET_REFERENCIAS_MARCA).download(caminho);
    if (error || !data) throw new Error(`REFERENCIA_MARCA_INDISPONIVEL:${caminho}`);
    const bytes = new Uint8Array(await data.arrayBuffer());
    return { type: 'image_url' as const, image_url: { url: `data:${mime};base64,${paraBase64(bytes)}` } };
  })().catch((erro) => {
    cachePorCaminho.delete(caminho); // falha transitória não pode "envenenar" o isolate
    throw erro;
  });
  cachePorCaminho.set(caminho, promessa);
  return promessa;
}

export function telasValidas(chaves: unknown): ChaveTelaDoApp[] {
  if (!Array.isArray(chaves)) return [];
  return chaves
    .filter((chave): chave is ChaveTelaDoApp => typeof chave === 'string' && chave in TELAS_DO_APP)
    .slice(0, MAXIMO_TELAS_POR_PEDIDO);
}

export function rotulosDasTelas(chaves: ChaveTelaDoApp[]): string {
  return chaves.map((chave) => TELAS_DO_APP[chave].rotulo).join(' e ');
}

export function carregarReferenciasDeMarca(
  admin: ReturnType<typeof createClient>,
  telasDoApp: ChaveTelaDoApp[] = [],
): Promise<ConteudoImagemMensagem[]> {
  const lista = [
    ...REFERENCIAS_BASE.map(({ caminho, mime }) => ({ caminho, mime })),
    ...telasDoApp.map((chave) => ({ caminho: TELAS_DO_APP[chave].caminho, mime: 'image/jpeg' })),
  ];
  return Promise.all(lista.map(({ caminho, mime }) => baixarReferencia(admin, caminho, mime)));
}

export const QUANTIDADE_REFERENCIAS_BASE = REFERENCIAS_BASE.length;
