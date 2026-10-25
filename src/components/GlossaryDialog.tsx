import { useEffect, useState } from 'react';
import type { GlossaryEntry } from '../types';
import type { BookmarksApi } from '../hooks/useBookmarks';
import { relatedTermsSharingAttributes } from '../crosslink';
import Icon from './Icon';

interface Props {
  api: BookmarksApi;
  onClose: () => void;
  notify: (text: string, kind?: 'ok' | 'info' | 'warn', detail?: string) => void;
}

/** Glossar-Verwaltung: eigene Begriffsketten definieren und editieren. */
export default function GlossaryDialog({ api, onClose, notify }: Props) {
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [related, setRelated] = useState('');
  const drafts = api.state.glossary; // direkt aus dem Zustand — immer aktuell

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => {
    const t = term.trim();
    if (!t) return;
    api.upsertGlossaryEntry({
      term: t,
      definition: definition.trim(),
      related: related.split(',').map((r) => r.trim()).filter(Boolean),
    });
    notify(`Glossar: „${t}" gespeichert`, 'ok', 'Passende Lesezeichen erhielten Tags/Kategorien.');
    setTerm('');
    setDefinition('');
    setRelated('');
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-label="Glossar">
        <h2>
          <Icon name="book" size={17} /> Glossar — eigene Begriffsketten
        </h2>
        <p className="hint">
          Definiere Abkürzungen und Projekte als Kette: <strong>Begriff → Erklärung + verwandte Themen</strong>. Der
          Manager nutzt das Glossar beim Import (Meta-Tags), für dynamische Gruppen und die intelligente
          Cross-Verlinkung („teilt SMMA mit …").
        </p>

        <ul className="glossary-list">
          {drafts.length === 0 && <li className="hint">Noch keine Begriffe. Beispiele: SMMA → Social Media Marketing · JayTX → Musiker Business, SMMA, Lyric Videos · ROFLnator.90 → MEME SMMA, Drive-Ordner, Auto-Posting</li>}
          {drafts.map((g) => (
            <GlossaryRow key={g.id} entry={g} api={api} all={drafts} />
          ))}
        </ul>

        <div className="glossary-new">
          <input type="text" placeholder="Begriff (z. B. SMMA oder JayTX)" value={term} onChange={(e) => setTerm(e.target.value)} />
          <input type="text" placeholder="Erklärung (z. B. Social Media Marketing)" value={definition} onChange={(e) => setDefinition(e.target.value)} />
          <input type="text" placeholder="Verwandte Themen, Komma-getrennt (z. B. Lyric Videos, Musik-Vertrieb)" value={related} onChange={(e) => setRelated(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <button className="btn primary" onClick={save} disabled={!term.trim()}>
            <Icon name="plus" size={14} /> Begriff speichern
          </button>
        </div>

        <div className="modal-actions">
          <button
            className="btn"
            onClick={() => {
              const n = api.applyGlossary();
              notify(`Glossar auf Bestand angewendet`, 'ok', `${n} Lesezeichen aktualisiert`);
            }}
          >
            <Icon name="refresh" size={14} /> Auf Bestand anwenden
          </button>
          <button className="btn primary" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

function GlossaryRow({ entry, api, all }: { entry: GlossaryEntry; api: BookmarksApi; all: GlossaryEntry[] }) {
  const [editing, setEditing] = useState(false);
  const [term, setTerm] = useState(entry.term);
  const [definition, setDefinition] = useState(entry.definition);
  const [related, setRelated] = useState(entry.related.join(', '));

  const shared = relatedTermsSharingAttributes(entry.term, all);

  if (editing) {
    return (
      <li className="glossary-row editing">
        <input value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Begriff" />
        <input value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="Erklärung" aria-label="Erklärung" />
        <input value={related} onChange={(e) => setRelated(e.target.value)} placeholder="Verwandte Themen" aria-label="Verwandte Themen" />
        <div className="glossary-row-actions">
          <button
            className="btn small primary"
            onClick={() => {
              api.upsertGlossaryEntry({ id: entry.id, term, definition, related: related.split(',').map((r) => r.trim()).filter(Boolean) });
              setEditing(false);
            }}
          >
            <Icon name="check" size={13} />
          </button>
          <button className="btn small" onClick={() => setEditing(false)}>
            <Icon name="x" size={13} />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="glossary-row">
      <div className="glossary-main">
        <strong>{entry.term}</strong>
        {entry.definition && <span className="glossary-def"> — {entry.definition}</span>}
        {entry.related.length > 0 && (
          <div className="glossary-related">
            {entry.related.map((r) => (
              <span key={r} className="chip">
                {r}
              </span>
            ))}
          </div>
        )}
        {shared.length > 0 && (
          <div className="glossary-shared">
            <Icon name="link" size={12} /> Cross-Verlinkung: {shared.map((s) => `${s.otherTerm} (via ${s.via[0]})`).join(' · ')}
          </div>
        )}
      </div>
      <div className="glossary-row-actions">
        <button className="btn icon" title="Bearbeiten" onClick={() => setEditing(true)}>
          <Icon name="edit" size={14} />
        </button>
        <button
          className="btn icon danger"
          title="Löschen"
          onClick={() => {
            api.removeGlossaryEntry(entry.id);
          }}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </li>
  );
}
