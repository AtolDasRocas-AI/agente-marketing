import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Icone } from '../../components/Icone';
import { gerarAvatar } from '../../lib/avatar/gerarAvatar';
import {
  buscarResultado, buscarSorteio, listarChances,
  type ResultadoPersistido, type SorteioResumo,
} from './api';
import { mensagemDeErro } from '../../lib/erro';

/* Paleta do canvas — espelha os tokens da Atol (não há var(--x) em canvas) */
const C = {
  ink: '#061820',
  glowTeal: 'rgba(92,197,190,0.22)',
  glowCoral: 'rgba(237,144,121,0.18)',
  teal: '#5CC5BE',
  text: '#F2E8D6',
  text2: '#C9C0AC',
  muted: '#8FA0A8',
  muted2: '#6A7B83',
  divisor: 'rgba(235,223,201,0.10)',
};

const SERIF = "'Instrument Serif', serif";
const SANS = "'Manrope', sans-serif";
const MONO = "'JetBrains Mono', monospace";

/** Desenha o card 1080×1920 (formato stories) — AC-14 */
function desenharCard(
  canvas: HTMLCanvasElement,
  sorteio: SorteioResumo,
  r: ResultadoPersistido
) {
  const L = 1080, A = 1920;
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // fundo em três camadas
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, L, A);
  const g1 = ctx.createRadialGradient(L * 0.8, -100, 0, L * 0.8, -100, 1100);
  g1.addColorStop(0, C.glowTeal);
  g1.addColorStop(1, 'rgba(92,197,190,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, L, A);
  const g2 = ctx.createRadialGradient(80, A + 100, 0, 80, A + 100, 900);
  g2.addColorStop(0, C.glowCoral);
  g2.addColorStop(1, 'rgba(237,144,121,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, L, A);

  ctx.textAlign = 'center';

  // eyebrow com letter-spacing manual (canvas não tem a propriedade)
  ctx.fillStyle = C.teal;
  ctx.font = `800 26px ${SANS}`;
  const eyebrow = 'SORTEIO ATOL · VERIFICÁVEL';
  const espaco = 5;
  const larguraEyebrow =
    [...eyebrow].reduce((soma, ch) => soma + ctx.measureText(ch).width + espaco, 0) - espaco;
  let cursor = (L - larguraEyebrow) / 2;
  ctx.textAlign = 'left';
  for (const ch of eyebrow) {
    ctx.fillText(ch, cursor, 150);
    cursor += ctx.measureText(ch).width + espaco;
  }
  ctx.textAlign = 'center';

  // título
  ctx.fillStyle = C.text;
  ctx.font = `400 76px ${SERIF}`;
  ctx.fillText('Resultado do sorteio', L / 2, 240);

  ctx.fillStyle = C.muted;
  ctx.font = `400 32px ${SANS}`;
  const tituloCurto = sorteio.titulo.length > 46 ? sorteio.titulo.slice(0, 46) + '…' : sorteio.titulo;
  ctx.fillText(tituloCurto, L / 2, 296);

  // vencedores
  let y = 430;
  ctx.fillStyle = C.muted;
  ctx.font = `800 30px ${SANS}`;
  ctx.fillText(r.vencedores.length > 1 ? 'GANHADORES' : 'VENCEDOR', L / 2, y);
  y += 90;

  for (const [i, v] of r.vencedores.entries()) {
    if (r.vencedores.length > 1) {
      ctx.fillStyle = C.teal;
      ctx.font = `800 26px ${SANS}`;
      ctx.fillText(`${i + 1}º LUGAR`, L / 2, y - 8);
      y += 26;
    }

    const av = gerarAvatar(v.autor_username);
    ctx.save();
    ctx.beginPath();
    ctx.arc(L / 2, y + 46, 60, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const grad = ctx.createLinearGradient(L / 2 - 60, y - 14, L / 2 + 60, y + 106);
    grad.addColorStop(0, `hsl(${av.matiz} 58% 52%)`);
    grad.addColorStop(1, `hsl(${(av.matiz + 52) % 360} 54% 40%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(L / 2 - 60, y - 14, 120, 120);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `800 42px ${SANS}`;
    ctx.fillText(av.iniciais, L / 2, y + 60);

    y += 150;
    ctx.fillStyle = C.text;
    ctx.font = `400 62px ${SERIF}`;
    ctx.fillText(`@${v.autor_username}`, L / 2, y);
    y += r.vencedores.length > 1 ? 76 : 90;
  }

  // suplentes
  if (r.suplentes.length) {
    y += 18;
    ctx.fillStyle = C.muted;
    ctx.font = `800 26px ${SANS}`;
    ctx.fillText('SUPLENTES', L / 2, y);
    y += 50;
    ctx.fillStyle = C.text2;
    ctx.font = `400 34px ${SANS}`;
    for (const [i, s] of r.suplentes.entries()) {
      ctx.fillText(`${i + 1}. @${s.autor_username}`, L / 2, y);
      y += 48;
    }
  }

  // números
  y = A - 560;
  ctx.strokeStyle = C.divisor;
  ctx.beginPath();
  ctx.moveTo(90, y);
  ctx.lineTo(L - 90, y);
  ctx.stroke();

  y += 70;
  const colunas: Array<[string, string]> = [
    ['comentários', String(r.total_comentarios)],
    ['concorrendo', String(r.total_habilitados)],
    ['chances', String(r.total_chances)],
  ];
  colunas.forEach(([rotulo, valor], i) => {
    const x = 180 + i * 360;
    ctx.fillStyle = C.text;
    ctx.font = `700 52px ${MONO}`;
    ctx.fillText(valor, x, y);
    ctx.fillStyle = C.muted;
    ctx.font = `400 28px ${SANS}`;
    ctx.fillText(rotulo, x, y + 42);
  });

  // prova
  y += 140;
  ctx.textAlign = 'left';
  ctx.fillStyle = C.muted;
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText('semente pública', 90, y);
  ctx.fillStyle = C.text2;
  ctx.font = `500 30px ${MONO}`;
  ctx.fillText(r.seed_publica.slice(0, 38), 90, y + 42);

  y += 100;
  ctx.fillStyle = C.muted;
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText('hash da lista · sha-256', 90, y);
  ctx.fillStyle = C.muted2;
  ctx.font = `400 23px ${MONO}`;
  ctx.fillText(r.hash_lista.slice(0, 32), 90, y + 38);
  ctx.fillText(r.hash_lista.slice(32), 90, y + 70);

  y += 130;
  ctx.fillStyle = C.muted2;
  ctx.font = `400 24px ${SANS}`;
  ctx.fillText(`executado em ${new Date(r.executado_em).toISOString()} UTC`, 90, y);

  ctx.textAlign = 'center';
  ctx.fillStyle = C.muted;
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText('🪸 atol.ai/sorteios', L / 2, A - 60);
}

export function Comprovante() {
  const { id } = useParams<{ id: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sorteio, setSorteio] = useState<SorteioResumo | null>(null);
  const [resultado, setResultado] = useState<ResultadoPersistido | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([buscarSorteio(id), buscarResultado(id)])
      .then(([s, r]) => {
        setSorteio(s);
        setResultado(r);
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, [id]);

  const redesenhar = useCallback(async () => {
    if (!canvasRef.current || !sorteio || !resultado) return;
    /* As três famílias precisam estar carregadas ANTES do fillText, senão
       o canvas cai no fallback serif do sistema — é o único ponto onde o
       redesign pode falhar silenciosamente em produção. */
    if (document.fonts?.load) {
      await Promise.all([
        document.fonts.load(`400 76px ${SERIF}`),
        document.fonts.load(`800 30px ${SANS}`),
        document.fonts.load(`700 52px ${MONO}`),
      ]).catch(() => undefined);
      await document.fonts.ready;
    }
    desenharCard(canvasRef.current, sorteio, resultado);
  }, [sorteio, resultado]);

  useEffect(() => {
    redesenhar();
  }, [redesenhar]);

  async function baixarCsv() {
    if (!id) return;
    const chances = await listarChances(id);
    const csv =
      'ordem,autor_username,ig_comment_id\n' +
      chances.map((c) => `${c.ordem},${c.autor_username},${c.ig_comment_id}`).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `participantes-${id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function baixarCard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `comprovante-${id?.slice(0, 8)}.png`;
    a.click();
  }

  if (erro)
    return (
      <div className="sx-wrap">
        <div className="sx-note sx-note--warn" role="alert">
          <Icone nome="info" tamanho={15} traco={2} />
          <span>{erro}</span>
        </div>
      </div>
    );
  if (!sorteio) return <p className="sx-hint">Carregando…</p>;
  if (!resultado)
    return (
      <div className="sx-wrap--narrow">
        <div className="sx-card sx-card--pad" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 22 }}>Sorteio ainda não executado</h2>
          <p className="sx-hint" style={{ marginTop: 8 }}>
            O comprovante aparece aqui depois da execução com a semente publicada.
          </p>
        </div>
      </div>
    );

  return (
    <div className="sx-wrap">
      <header className="sx-head">
        <p className="ra-eyebrow">Comprovante</p>
        <h1 className="sx-h1">
          Prova <em>pública</em> do resultado
        </h1>
        <p className="sx-lede">
          Card pronto para os stories, mais o CSV e o comando que qualquer participante roda
          para recalcular o vencedor.
        </p>
      </header>

      <div className="sx-proof-row">
        <canvas
          ref={canvasRef}
          style={{
            width: 296,
            aspectRatio: '1080 / 1920',
            flex: 'none',
            borderRadius: 16,
            border: '1px solid var(--hairline-2)',
          }}
        />

        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="sx-card">
            <p className="sx-proof-label">Números da rodada</p>
            <dl className="sx-kv">
              <dt>Semente pública</dt>
              <dd>{resultado.seed_publica}</dd>
              <dt>Publicada em</dt>
              <dd>{resultado.seed_fonte}</dd>
              <dt>Hash da lista</dt>
              <dd>{resultado.hash_lista}</dd>
              <dt>Execução (UTC)</dt>
              <dd>{new Date(resultado.executado_em).toISOString()}</dd>
              <dt>Comentários</dt>
              <dd>{resultado.total_comentarios}</dd>
              <dt>Chances na urna</dt>
              <dd>{resultado.total_chances}</dd>
            </dl>
          </div>

          <div className="sx-card">
            <p className="sx-proof-label">Qualquer um confere</p>
            <pre className="sx-code">{`node verificador/verificar.mjs \\
  participantes.csv "${resultado.seed_publica}" ${resultado.vencedores.length} ${resultado.suplentes.length}`}</pre>
            <p className="sx-hint" style={{ marginTop: 10 }}>
              Script autocontido, sem dependências. Reproduz o hash, a semente final e os
              vencedores.
            </p>
          </div>

          <div className="sx-row">
            <button className="sx-btn sx-btn--primary" onClick={baixarCard}>
              <Icone nome="download" tamanho={15} traco={2} />
              Card 1080×1920
            </button>
            <button className="sx-btn" onClick={() => window.print()}>
              <Icone nome="download" tamanho={15} traco={2} />
              PDF
            </button>
            <button className="sx-btn" onClick={baixarCsv}>
              <Icone nome="download" tamanho={15} traco={2} />
              CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
