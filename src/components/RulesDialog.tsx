import { useState } from 'react';
import type { CategorizeRule } from '../types';
import type { BookmarksApi } from '../hooks/useBookmarks';
import { uid } from '../rules';

/**
 * Regel-Editor: zeigt die automatische Kategorisierung transparent und editierbar.
 * „Alle neu kategorisieren" wendet die Regeln erneut auf den Gesamtbestand an.
 */
export default function RulesDialog({ api, onClose }: { api: BookmarksApi; onClose: () => void }) {
  const [draft, setDraft] = useState<CategorizeRule[]>(api.state.rules);
  const [newPattern, setNewPattern] = useState('');
  const [newKind, setNewKind] = useState<CategorizeRule['kind']>('keyword');
  const [newCats, setNewCats] = useState('');

  const patch = (id: string, changes: Partial<CategorizeRule>) =>
    setDraft((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));

  const addRule = () => {
    const pattern = newPattern.trim().toLowerCase();
    const categories = newCats
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (!pattern || categories.length === 0) return;
    setDraft((prev) => [...prev, { id: uid('rule'), pattern, kind: newKind, categories, enabled: true }]);
    setNewPattern('');
    setNewCats('');
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-label="Kategorisierungs-Regeln">
        <h2>⚙ Kategorisierungs-Regeln</h2>
        <p className="hint">
          <strong>Domain</strong>-Regeln matchen den Hostnamen, <strong>Schlüsselwort</strong>-Regeln Host + Pfad +
          Titel. Ein Link darf in mehrere Kategorien gleichzeitig fallen (Mehrfachzuordnung). Passt keine Regel, wird
          automatisch eine Kategorie pro Domain angelegt.
        </p>
        <ul className="rule-list">
          {draft.map((r) => (
            <li key={r.id} className="rule-row">
              <label className="switch" title="Regel aktiv?">
                <input type="checkbox" checked={r.enabled} onChange={(e) => patch(r.id, { enabled: e.target.checked })} />
              </label>
              <select value={r.kind} onChange={(e) => patch(r.id, { kind: e.target.value as CategorizeRule['kind'] })}>
                <option value="domain">Domain</option>
                <option value="keyword">Schlüsselwort</option>
              </select>
              <input
                className="rule-pattern"
                type="text"
                value={r.pattern}
                onChange={(e) => patch(r.id, { pattern: e.target.value })}
              />
              <span className="arrow">→</span>
              <input
                className="rule-cats"
                type="text"
                value={r.categories.join(', ')}
                onChange={(e) => patch(r.id, { categories: e.target.value.split(',').map((c) => c.trim()).filter(Boolean) })}
                title="Ziel-Kategorien, Komma-getrennt"
              />
              <button className="btn icon danger" title="Regel löschen" onClick={() => setDraft((prev) => prev.filter((x) => x.id !== r.id))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="rule-new">
          <select value={newKind} onChange={(e) => setNewKind(e.target.value as CategorizeRule['kind'])}>
            <option value="domain">Domain</option>
            <option value="keyword">Schlüsselwort</option>
          </select>
          <input type="text" placeholder="Muster, z. B. github.com" value={newPattern} onChange={(e) => setNewPattern(e.target.value)} />
          <span className="arrow">→</span>
          <input type="text" placeholder="Kategorien, z. B. GitHub, Entwicklung" value={newCats} onChange={(e) => setNewCats(e.target.value)} />
          <button className="btn" type="button" onClick={addRule}>
            + Regel
          </button>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button
            className="btn"
            onClick={() => {
              if (confirm('Alle Lesezeichen neu kategorisieren? Manuelle Zuordnungen werden dabei durch Ordnerherkunft + Regeln ersetzt.')) {
                api.setRules(draft);
                api.recategorizeAll();
                onClose();
              }
            }}
          >
            ↻ Speichern &amp; alles neu kategorisieren
          </button>
          <button
            className="btn primary"
            onClick={() => {
              api.setRules(draft);
              onClose();
            }}
          >
            Regeln speichern
          </button>
        </div>
      </div>
    </div>
  );
}
