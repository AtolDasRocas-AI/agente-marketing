export interface Barra { rotulo: string; valor: number }

/** SVG artesanal, sem dependência — comparação de valores por categoria. */
export function GraficoBarras({ barras, altura = 160, largura = 280 }: { barras: Barra[]; altura?: number; largura?: number }) {
  if (barras.length === 0) return <p className="sx-hint">Sem dados suficientes para comparar.</p>;
  const margem = { topo: 18, base: 22, lado: 6 };
  const max = Math.max(...barras.map((b) => b.valor), 1);
  const alturaUtil = altura - margem.topo - margem.base;
  const larguraUtil = largura - margem.lado * 2;
  const larguraBarra = larguraUtil / barras.length;
  const espaco = larguraBarra * 0.3;
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} width="100%" height={altura} role="img" aria-label="Gráfico de comparação">
      {barras.map((b, i) => {
        const alturaBarra = Math.max((b.valor / max) * alturaUtil, b.valor > 0 ? 2 : 0);
        const x = margem.lado + i * larguraBarra + espaco / 2;
        const largBarra = larguraBarra - espaco;
        const yTopo = margem.topo + (alturaUtil - alturaBarra);
        return (
          <g key={b.rotulo + i}>
            <rect x={x} y={yTopo} width={largBarra} height={alturaBarra} rx={3} fill="var(--teal)" />
            <text x={x + largBarra / 2} y={yTopo - 4} fontSize={10} fill="var(--text-2)" textAnchor="middle">{Math.round(b.valor)}</text>
            <text x={x + largBarra / 2} y={altura - 6} fontSize={10} fill="var(--muted)" textAnchor="middle">{b.rotulo}</text>
          </g>
        );
      })}
    </svg>
  );
}
