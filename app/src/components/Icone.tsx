/**
 * Ícones SVG inline — 24×24 viewBox, stroke currentColor.
 * Espessura conforme o handoff: 1.9 no rail, 1.7 nos cards de post,
 * 2 nos pequenos (info, cadeado, download, check), 3 no check do badge.
 */
export type NomeIcone =
  | 'inicio' | 'novo' | 'pessoas' | 'sortear' | 'palco' | 'comprovante'
  | 'historico' | 'conta' | 'foto' | 'video' | 'carrossel' | 'info'
  | 'cadeado' | 'download' | 'check' | 'mais' | 'lixeira' | 'externo' | 'agenda';

const PATHS: Record<NomeIcone, string> = {
  inicio: 'M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5',
  novo: 'M12 5v14M5 12h14',
  pessoas: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.25 3.25 0 0 1 0 6.1',
  sortear: 'M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z',
  palco: 'M4 5h16v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V5ZM9 18v3h6v-3M20 7h1.5a2 2 0 0 1 0 4H20M4 7H2.5a2 2 0 0 0 0 4H4',
  comprovante: 'M6 3h9l4 4v14H6V3ZM14 3v5h5M9.5 13h6M9.5 17h4',
  historico: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V10h5.5M12 8v4.5l3.5 2',
  conta: 'M4.5 20v-1.5A4.5 4.5 0 0 1 9 14h6a4.5 4.5 0 0 1 4.5 4.5V20M12 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z',
  foto: 'M4 5h16v14H4V5ZM4 15.5l4.5-4 3.5 3 3-2.5L20 16M15.5 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  video: 'M4 6h11v12H4V6ZM15 10.5 20 8v8l-5-2.5v-3Z',
  carrossel: 'M8 4h12v12H8V4ZM4 8v12h12',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
  cadeado: 'M6 11h12v9H6v-9ZM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  download: 'M12 3v11m0 0 4-4m-4 4-4-4M4 19h16',
  check: 'm5 12.5 4.5 4.5L19 7',
  mais: 'M12 5v14M5 12h14',
  lixeira: 'M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10.5 11v5M13.5 11v5',
  externo: 'M14 4h6v6M20 4l-8.5 8.5M17 14v6H4V7h6',
  agenda: 'M5 4v3M19 4v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM8 13h3M8 17h6',
};

interface IconeProps {
  nome: NomeIcone;
  tamanho?: number;
  traco?: number;
}

export function Icone({ nome, tamanho = 17, traco = 1.9 }: IconeProps) {
  return (
    <svg
      aria-hidden="true"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={traco}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[nome]} />
    </svg>
  );
}
