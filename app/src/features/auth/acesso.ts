export const EMAILS_PERMITIDOS = ['atoldasrocas.ai@gmail.com', 'lipe.kosse@gmail.com'];

export function emailPermitido(email: string | undefined) {
  return !!email && EMAILS_PERMITIDOS.includes(email.toLowerCase());
}
