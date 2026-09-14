import { gerarAvatar } from '../lib/avatar/gerarAvatar';

type Tamanho = 'md' | 'lg' | 'xl';

interface AvatarProps {
  username: string | null;
  /** md 32px (listas, roleta) · lg 64px (comprovante) · xl 92px (palco) */
  tamanho?: Tamanho;
  className?: string;
}

const CLASSE: Record<Tamanho, string> = {
  md: 'sx-av',
  lg: 'sx-av sx-av--lg',
  xl: 'sx-av sx-av--xl',
};

/** Avatar determinístico por username (CAP-11) */
export function Avatar({ username, tamanho = 'md', className = '' }: AvatarProps) {
  const { iniciais, gradiente, corTexto } = gerarAvatar(username ?? '');
  return (
    <div
      aria-hidden="true"
      className={`${CLASSE[tamanho]} ${className}`.trim()}
      style={{ background: gradiente, color: corTexto }}
    >
      {iniciais}
    </div>
  );
}
