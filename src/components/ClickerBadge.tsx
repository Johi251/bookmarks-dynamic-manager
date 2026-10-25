import type { Bookmark } from '../types';

interface Props {
  bookmarkId: string;
  clicker: NonNullable<Bookmark['clicker']>;
  onOnline: (launchUrl: string) => void;
  onLocal: (bookmarkId: string) => void;
  compact?: boolean;
}

const LABEL: Record<string, string> = { checking: 'Checking', online: 'Online', local: 'Lokal' };

/**
 * 1Clicker-Status-Badge: 🟠 blinkend (Analyse), 🟢 leuchtend (1 Klick online),
 * 🔵 leuchtend (1 Klick lokal). Klick auf 🟢 öffnet die Live-Anwendung,
 * Klick auf 🔵 öffnet die lokale Bereitstellung (Rezept-Dialog).
 */
export default function ClickerBadge({ bookmarkId, clicker, onOnline, onLocal, compact = false }: Props) {
  if (clicker.status === 'none') return null;
  const label = LABEL[clicker.status] ?? clicker.status;
  const tip =
    clicker.status === 'checking'
      ? '1Clicker: Repository wird im Hintergrund analysiert …'
      : clicker.status === 'online'
        ? `1Clicker: Kostenlos online nutzbar${clicker.reason ? ` — ${clicker.reason}` : ''}. Klick öffnet die Live-Anwendung.`
        : `1Clicker: Kostenlos lokal nutzbar${clicker.reason ? ` — ${clicker.reason}` : ''}. Klick zeigt die lokale Bereitstellung.`;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clicker.status === 'online' && clicker.launchUrl) onOnline(clicker.launchUrl);
    else if (clicker.status === 'local') onLocal(bookmarkId);
  };

  return (
    <button
      type="button"
      className={`clicker-badge ${clicker.status}${compact ? ' dot-only' : ''}`}
      onClick={handleClick}
      title={tip}
      aria-label={tip}
    >
      <span className="clicker-dot" aria-hidden="true" />
      {!compact && <span className="clicker-label">{label}</span>}
    </button>
  );
}
