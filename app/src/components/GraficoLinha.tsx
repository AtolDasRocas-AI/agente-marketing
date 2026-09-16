export interface PontoLinha { rotulo: string; valor: number }

/** SVG artesanal, sem dependência — linha de tendência ao longo do tempo. */
export function GraficoLinha({ pontos, altura = 160, largura = 560 }: { pontos: PontoLinha[]; altura?: number; largura?: number }) {
  if (pontos.length < 2) return <p className="sx-hint">Dados insuficientes para mostrar tendência.</p>;
  const margem = { topo: 12, base: 22, lado: 6 };
  const valores = pontos.map((p) => p.valor);
  const min = Math.min(0, ...valores);
  const max = Math.max(...valores, min + 1);
  const alturaUtil = altura - margem.topo - margem.base;
  const larguraUtil = largura - margem.lado * 2;
  const x = (indice: number) => margem.lado + (indice / (pontos.length - 1)) * larguraUtil;
  const y = (valor: number) => margem.topo + alturaUtil - ((valor - min) / (max - min)) * alturaUtil;
  const linha = pontos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ');
  const area = `${x(0)},${y(min)} ${linha} ${x(pontos.length - 1)},${y(min)}`;
  const passoRotulo = Math.max(1, Math.ceil(pontos.length / 6));
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} width="100%" height={altura} role="img" aria-label="Gráfico de tendência">
      <polyline points={area} fill="var(--teal-glow)" stroke="none" />
      <polyline points={linha} fill="none" stroke="var(--teal)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pontos.map((p, i) => (i % passoRotulo === 0 || i === pontos.length - 1) && (
        <text key={p.rotulo + i} x={x(i)} y={altura - 6} fontSize={10} fill="var(--muted)" textAnchor="middle">{p.rotulo}</text>
      ))}
    </svg>
  );
}
