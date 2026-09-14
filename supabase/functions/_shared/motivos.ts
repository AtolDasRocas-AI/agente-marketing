// ╔══════════════════════════════════════════════════════════════╗
// ║ ARQUIVO GERADO — não edite aqui.                             ║
// ║ Fonte: app/src/lib/sorteio/motivos.ts                                              ║
// ║ Atualize com: node scripts/sincronizar-motores.mjs           ║
// ╚══════════════════════════════════════════════════════════════╝

/** Motivos de qualificação/desqualificação (AC-09) */
export const MOTIVOS = {
  IGNORADO_REPLY: 'Resposta a outro comentário',
  AUTOR_ORGANIZADOR: 'Comentário do organizador',
  USUARIO_INDISPONIVEL: 'Conta indisponível ou removida',
  FORA_DA_JANELA: 'Fora do período do sorteio',
  MENCOES_INSUFICIENTES: 'Menções insuficientes',
  PALAVRA_AUSENTE: 'Sem a palavra obrigatória',
  DUPLICADO: 'Já tem 1 chance — comentário extra',
  TETO_EXCEDIDO: 'Já atingiu o teto de chances',
  SUSPEITO_AUTOMACAO: 'Suspeita de automação — revisar',
  HABILITADO: 'Habilitado',
} as const;

export type Motivo = keyof typeof MOTIVOS;

/** Sinais de anti-bot (flag, nunca exclusão automática) */
export const FLAGS_SUSPEITA = {
  EXCESSO_MENCOES: 'Excesso de menções',
  TEXTO_CLONADO: 'Texto idêntico a outros participantes',
  RAJADA: 'Comentários em rajada',
} as const;

export type FlagSuspeita = keyof typeof FLAGS_SUSPEITA;

export function rotuloMotivo(motivo: string | null | undefined): string {
  if (!motivo) return '—';
  return (
    MOTIVOS[motivo as Motivo] ??
    FLAGS_SUSPEITA[motivo as FlagSuspeita] ??
    motivo
  );
}
