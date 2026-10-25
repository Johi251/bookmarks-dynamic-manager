import { useEffect, useState } from 'react';
import type { TermCandidate } from '../ai/engine';
import type { BookmarksApi } from '../hooks/useBookmarks';
import Icon from './Icon';

interface Props {
  api: BookmarksApi;
  candidates: TermCandidate[];
  onClose: () => void;
  notify: (text: string, kind?: 'ok' | 'info' | 'warn', detail?: string) => void;
}

/**
 * Interaktives Lernen: Unbekannte, markante Begriffe aus Import/Bestand werden
 * vorgeschlagen — der Nutzer definiert sie („Was genau meinst du damit?") und
 * füttert damit das Glossar; Treffer erhalten sofort Tags/Kategorien.
 */
export default function GlossaryLearnDialog({ api, candidates, onClose, notify }: Props) {
  const [defs, setDefs] = useState<Record<string, { definition: string; related: string }>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const define = (candidate: TermCandidate) => {
    const d = defs[candidate.term];
    api.upsertGlossaryEntry({
      term: candidate.term,
      definition: d?.definition?.trim() ?? '',
      related: (d?.related ?? '').split(',').map((r) => r.trim()).filter(Boolean),
    });
    notify(`„${candidate.term}" ins Glossar übernommen`, 'ok', `${candidate.count} Vorkommen erkannt`);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-label="Glossar lernen">
        <h2>
          <Icon name="sparkles" size={17} /> Was genau meinst du damit?
        </h2>
        <p className="hint">
          Diese markanten Begriffe sind im Glossar noch <strong>unbekannt</strong>. Definiere sie — der Manager
          verschlagwortet und cross-verlinkt passende Lesezeichen sofort automatisch. Felder leer lassen und speichern
          nimmt den Begriff ohne Erklärung auf.
        </p>
        {candidates.length === 0 && <p className="hint">Aktuell keine unbekannten Begriffe erkannt.</p>}
        <ul className="learn-list">
          {candidates.map((c) => (
            <li key={c.term} className="learn-row">
              <div className="learn-term">
                <strong>{c.term}</strong>
                <span className="count">{c.count}×</span>
                <span className="learn-example" title={c.examples.map((e) => e.url).join('\n')}>
                  z. B. {c.examples[0]?.title ?? ''}
                </span>
              </div>
              <div className="learn-inputs">
                <input
                  type="text"
                  placeholder="Was bedeutet das? (z. B. Social Media Marketing)"
                  value={defs[c.term]?.definition ?? ''}
                  onChange={(e) => setDefs((prev) => ({ ...prev, [c.term]: { definition: e.target.value, related: prev[c.term]?.related ?? '' } }))}
                />
                <input
                  type="text"
                  placeholder="Verwandte Themen (z. B. Lyric Videos, Musik-Vertrieb)"
                  value={defs[c.term]?.related ?? ''}
                  onChange={(e) => setDefs((prev) => ({ ...prev, [c.term]: { definition: prev[c.term]?.definition ?? '', related: e.target.value } }))}
                  onKeyDown={(e) => e.key === 'Enter' && define(c)}
                />
              </div>
              <button className="btn small primary" onClick={() => define(c)}>
                <Icon name="check" size={13} /> Definieren
              </button>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
