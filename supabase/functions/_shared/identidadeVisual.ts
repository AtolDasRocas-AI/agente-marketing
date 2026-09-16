// Referências visuais REAIS da marca ATOL (logo oficial, clima visual e telas do app
// real), usadas para ancorar a geração de imagem por IA em algo além de descrição em
// texto. Os 4 arquivos vivem no bucket privado `marketing-referencias-marca`
// (migration 0035) e são populados por `scripts/semear-marketing-brand-assets.mjs` a
// partir do projeto real do app (fora deste repo). Institucionais e fixos — não há
// nada por-workspace aqui.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET_REFERENCIAS_MARCA = 'marketing-referencias-marca';

// A ordem importa: é a ordem em que as imagens entram na mensagem enviada ao modelo,
// e o texto do prompt referencia essa ordem por posição (ver marketing-gerar-imagem).
const REFERENCIAS_DE_MARCA = [
  { caminho: 'logotipo-marca.webp', mime: 'image/webp' },
  { caminho: 'clima-visual-recife.jpg', mime: 'image/jpeg' },
  { caminho: 'tela-dashboard.jpg', mime: 'image/jpeg' },
  { caminho: 'tela-assistente-ia.jpg', mime: 'image/jpeg' },
] as const;

export type ConteudoImagemMensagem = { type: 'image_url'; image_url: { url: string } };

// Memoizado em escopo de módulo: estes 4 arquivos só mudam por reseed manual (evento
// raro), e todo `supabase functions deploy` recicla o isolate e zera este cache — não
// vale a complexidade de um TTL para um asset que não muda em produção normal.
let cachePromise: Promise<ConteudoImagemMensagem[]> | null = null;

function paraBase64(bytes: Uint8Array): string {
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

export function referenciasDeMarcaHabilitadas(): boolean {
  return Deno.env.get('MARKETING_AI_IMAGE_BRAND_REFS_ENABLED') !== 'false';
}

export function carregarReferenciasDeMarca(
  admin: ReturnType<typeof createClient>,
): Promise<ConteudoImagemMensagem[]> {
  if (!cachePromise) {
    cachePromise = Promise.all(
      REFERENCIAS_DE_MARCA.map(async ({ caminho, mime }) => {
        const { data, error } = await admin.storage.from(BUCKET_REFERENCIAS_MARCA).download(caminho);
        if (error || !data) throw new Error(`REFERENCIA_MARCA_INDISPONIVEL:${caminho}`);
        const bytes = new Uint8Array(await data.arrayBuffer());
        return { type: 'image_url' as const, image_url: { url: `data:${mime};base64,${paraBase64(bytes)}` } };
      }),
    ).catch((erro) => {
      cachePromise = null; // não deixa uma falha transitória "envenenar" o isolate para sempre
      throw erro;
    });
  }
  return cachePromise;
}

export const QUANTIDADE_REFERENCIAS_DE_MARCA = REFERENCIAS_DE_MARCA.length;
