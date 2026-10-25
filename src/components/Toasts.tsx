import { useEffect, useState } from 'react';
import Icon, { type IconName } from './Icon';

/** Dezente Rückmeldungen für Aktionen (Mikro-Interaktion: sofortiges Feedback). */
export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'info' | 'warn';
  detail?: string;
}

let nextId = 1;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (text: string, kind: Toast['kind'] = 'ok', detail?: string) => {
    const t: Toast = { id: nextId++, text, kind, detail };
    setToasts((prev) => [...prev.slice(-3), t]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4200);
  };
  return { toasts, push };
}

const KIND_ICON: Record<Toast['kind'], IconName> = { ok: 'check', info: 'sparkles', warn: 'alert' };

export function ToastHost({ toasts }: { toasts: Toast[] }) {
  const [, force] = useState(0);
  useEffect(() => force((n) => n + 1), [toasts.length]); // für Einblende-Animation
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <Icon name={KIND_ICON[t.kind]} size={15} />
          <div className="toast-body">
            <span>{t.text}</span>
            {t.detail && <span className="toast-detail">{t.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
