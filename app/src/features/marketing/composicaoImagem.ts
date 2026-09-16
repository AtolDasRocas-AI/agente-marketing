// Compõe o texto de um post "informativo" sobre a imagem de fundo gerada por IA, de forma
// determinística — nunca pedindo para a própria IA de imagem "escrever" o texto (ela erra
// grafia com frequência). Usa as fontes e cores reais da marca ATOL (src/styles/theme.css
// do app real), carregadas de app/public/fonts.
import type { TextoOverlay } from './aiRemote';

const LADO_CANVAS = 1080;
const MARGEM = 64;

// Paleta real da marca (ver IDENTIDADE_VISUAL_ATOL em marketing-gerar-conteudo).
const COR_FAIXA_INICIO = 'rgba(14, 42, 63, 0)';
const COR_FAIXA_MEIO = 'rgba(14, 42, 63, 0.92)';
const COR_FAIXA_FIM = 'rgba(6, 24, 32, 0.96)';
const COR_TEXTO = '#f2e8d6';
const COR_NUMERO_FUNDO = '#ed9079';
const COR_NUMERO_TEXTO = '#061820';

let fontesCarregadas: Promise<void> | null = null;

function carregarFontesDeMarca(): Promise<void> {
  if (!fontesCarregadas) {
    fontesCarregadas = Promise.all([
      new FontFace('Instrument Serif', "url('/fonts/InstrumentSerif-Regular.woff2')").load()
        .then((fonte) => { document.fonts.add(fonte); }),
      new FontFace('Manrope', "url('/fonts/Manrope-Medium.woff2')", { weight: '500' }).load()
        .then((fonte) => { document.fonts.add(fonte); }),
      new FontFace('Manrope', "url('/fonts/Manrope-Bold.woff2')", { weight: '700' }).load()
        .then((fonte) => { document.fonts.add(fonte); }),
    ]).then(() => undefined);
  }
  return fontesCarregadas;
}

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.crossOrigin = 'anonymous';
    imagem.onload = () => resolve(imagem);
    imagem.onerror = () => reject(new Error('Não foi possível carregar a imagem de fundo.'));
    imagem.src = url;
  });
}

function quebrarLinhas(ctx: CanvasRenderingContext2D, texto: string, larguraMaxima: number): string[] {
  const palavras = texto.split(' ');
  const linhas: string[] = [];
  let linhaAtual = '';
  for (const palavra of palavras) {
    const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
    if (linhaAtual && ctx.measureText(tentativa).width > larguraMaxima) {
      linhas.push(linhaAtual);
      linhaAtual = palavra;
    } else {
      linhaAtual = tentativa;
    }
  }
  if (linhaAtual) linhas.push(linhaAtual);
  return linhas;
}

export async function comporImagemInformativa(urlImagemFundo: string, textoOverlay: TextoOverlay): Promise<string> {
  await carregarFontesDeMarca();
  const imagem = await carregarImagem(urlImagemFundo);

  const canvas = document.createElement('canvas');
  canvas.width = LADO_CANVAS;
  canvas.height = LADO_CANVAS;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não suporta a composição de imagem.');

  // Fundo cobrindo o canvas inteiro (equivalente a object-fit: cover).
  const escala = Math.max(LADO_CANVAS / imagem.width, LADO_CANVAS / imagem.height);
  const largura = imagem.width * escala;
  const altura = imagem.height * escala;
  ctx.drawImage(imagem, (LADO_CANVAS - largura) / 2, (LADO_CANVAS - altura) / 2, largura, altura);

  // Faixa de contraste na base — sempre aplicada, porque o fundo gerado por IA pode ter
  // qualquer luminosidade onde o texto cairia.
  const alturaFaixa = LADO_CANVAS * 0.5;
  const gradiente = ctx.createLinearGradient(0, LADO_CANVAS - alturaFaixa, 0, LADO_CANVAS);
  gradiente.addColorStop(0, COR_FAIXA_INICIO);
  gradiente.addColorStop(0.35, COR_FAIXA_MEIO);
  gradiente.addColorStop(1, COR_FAIXA_FIM);
  ctx.fillStyle = gradiente;
  ctx.fillRect(0, LADO_CANVAS - alturaFaixa, LADO_CANVAS, alturaFaixa);

  const larguraTexto = LADO_CANVAS - MARGEM * 2;
  let y = LADO_CANVAS - alturaFaixa + 56;

  if (textoOverlay.titulo) {
    ctx.fillStyle = COR_TEXTO;
    ctx.font = "56px 'Instrument Serif'";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (const linha of quebrarLinhas(ctx, textoOverlay.titulo, larguraTexto)) {
      ctx.fillText(linha, MARGEM, y);
      y += 64;
    }
    y += 24;
  }

  const raioCirculo = 24;
  for (const [indice, item] of textoOverlay.itens.entries()) {
    ctx.font = "500 34px 'Manrope'";
    const xTexto = MARGEM + raioCirculo * 2 + 20;
    const linhasItem = quebrarLinhas(ctx, item, larguraTexto - raioCirculo * 2 - 20);

    const centroCirculoY = y + raioCirculo;
    ctx.fillStyle = COR_NUMERO_FUNDO;
    ctx.beginPath();
    ctx.arc(MARGEM + raioCirculo, centroCirculoY, raioCirculo, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COR_NUMERO_TEXTO;
    ctx.font = "700 28px 'Manrope'";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(indice + 1), MARGEM + raioCirculo, centroCirculoY + 1);

    ctx.fillStyle = COR_TEXTO;
    ctx.font = "500 34px 'Manrope'";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let yItem = y;
    for (const linha of linhasItem) {
      ctx.fillText(linha, xTexto, yItem);
      yItem += 40;
    }
    y += Math.max(raioCirculo * 2 + 16, linhasItem.length * 40 + 16);
  }

  return canvas.toDataURL('image/png');
}
