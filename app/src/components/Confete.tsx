import { useEffect, useRef } from 'react';

/**
 * Confete em canvas — sem dependências, respeita reduced-motion (E-22).
 * Usa um PRNG local (não precisa ser auditável: é só enfeite).
 */
export function Confete({ ativo, duracao = 3500 }: { ativo: boolean; duracao?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ativo) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const largura = canvas.offsetWidth;
    const altura = canvas.offsetHeight;
    canvas.width = largura * dpr;
    canvas.height = altura * dpr;
    ctx.scale(dpr, dpr);

    // paleta da Atol: teal, coral, areia, musgo, âmbar
    const cores = ['#5CC5BE', '#ED9079', '#EBDFC9', '#5C9D8E', '#E8B85F'];
    const pedacos = Array.from({ length: 140 }, () => ({
      x: Math.random() * largura,
      y: -20 - Math.random() * altura * 0.5,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 2 + Math.random() * 3.2,
      vx: -1.2 + Math.random() * 2.4,
      giro: Math.random() * Math.PI,
      vGiro: -0.12 + Math.random() * 0.24,
      cor: cores[Math.floor(Math.random() * cores.length)],
    }));

    let animacao = 0;
    const inicio = performance.now();

    function quadro(agora: number) {
      const t = (agora - inicio) / duracao;
      ctx!.clearRect(0, 0, largura, altura);
      for (const p of pedacos) {
        p.x += p.vx;
        p.y += p.vy;
        p.giro += p.vGiro;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.giro);
        ctx!.globalAlpha = Math.max(0, 1 - t);
        ctx!.fillStyle = p.cor;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
      }
      if (t < 1) animacao = requestAnimationFrame(quadro);
      else ctx!.clearRect(0, 0, largura, altura);
    }
    animacao = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(animacao);
  }, [ativo, duracao]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
        opacity: ativo ? 1 : 0,
      }}
    />
  );
}
