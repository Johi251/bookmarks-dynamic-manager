import { useState } from 'react';
import Icon, { type IconName } from './Icon';

interface Props { actions: { label: string; icon: IconName; run: () => void }[] }
export default function QuickMenu({ actions }: Props) {
  const [open, setOpen] = useState(false);
  return <div className={`quick-orbit ${open ? 'open' : ''}`} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
    <button className="orbit-brand" aria-label="Schnellwahl" aria-expanded={open} onClick={() => setOpen(!open)}><span aria-hidden="true">https://<b>✓</b></span></button>
    {open && <div className="orbit-actions" role="group" aria-label="Sechs Schnellzugriffe">
      {actions.slice(0, 6).map((action, i) => <button key={action.label} className="orbit-item" style={{ '--angle': `${i * 60 - 90}deg`, '--counter': `${90 - i * 60}deg` } as React.CSSProperties} title={action.label} aria-label={action.label} onClick={() => { setOpen(false); action.run(); }}><Icon name={action.icon} size={18} /></button>)}
    </div>}
  </div>;
}
