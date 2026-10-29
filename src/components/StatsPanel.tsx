import { useMemo, useState } from 'react';
import type { BookmarksApi } from '../hooks/useBookmarks';
import { computeStats, findDuplicates } from '../stats';
import { hostOf } from '../host';
import Icon from './Icon';

interface Props {
  api: BookmarksApi;
  notify: (text: string, kind?: 'ok' | 'info' | 'warn', detail?: string, action?: { label: string; run: () => void }) => void;
}

/**
 * Statistik-Tab: Bestands-Kennzahlen, Aktivitätsverlauf (12 Wochen),
 * Top-Webseiten/-Tags und Dubletten-Bereinigung mit Behalten-Empfehlung
 * (angepinnt > häufig geöffnet > jünger) und Undo über Strg+Z.
 */
export default function StatsPanel({ api, notify }: Props) {
  const [dupsOpen, setDupsOpen] = useState(false);
  const stats = useMemo(() => computeStats(api.state), [api.state]);
  const duplicates = useMemo(() => findDuplicates(api.state.bookmarks), [api.state.bookmarks]);

  const maxActivity = Math.max(1, ...stats.activity);
  const maxHost = Math.max(1, ...stats.topHosts.map((h) => h.count));
  const maxTag = Math.max(1, ...stats.topTags.map((t) => t.count));

  /** Löscht alle Gruppen-Mitglieder außer dem Behalten-Kandidaten (der erste). */
  const cleanup = (groupKeys: string[]) => {
    const removeIds: string[] = [];
    for (const key of groupKeys) {
      const g = duplicates.find((d) => d.key === key);
      if (g) removeIds.push(...g.bookmarks.slice(1).map((b) => b.id));
    }
    if (removeIds.length === 0) return;
    api.mergeDuplicates(duplicates.filter((g) => groupKeys.includes(g.key)).map((g) => g.bookmarks.map((b) => b.id)));
    notify(
      `${removeIds.length} Dublette${removeIds.length === 1 ? '' : 'n'} entfernt`,
      'ok',
      'Strg+Z macht die Bereinigung rückgängig',
      { label: 'Rückgängig', run: () => api.undo() }
    );
  };

  const cleanupAll = () => {
    if (duplicates.length === 0) return;
    if (!confirm(`Alle ${duplicates.length} Dublettengruppen bereinigen?\n\nPro Gruppe bleibt der empfohlene Eintrag erhalten (angepinnt > geöffnet > jünger). Strg+Z macht alles rückgängig.`)) return;
    cleanup(duplicates.map((d) => d.key));
  };

  return (
    <section className="stats" aria-label="Statistik">
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-num">{stats.total}</span>
          <span className="stat-label">Lesezeichen</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{stats.categories}</span>
          <span className="stat-label">Kategorien</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{stats.tags}</span>
          <span className="stat-label">Tags</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{stats.avgCategories.toFixed(1)}</span>
          <span className="stat-label">Ø Kategorien pro Link</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{stats.totalOpens}</span>
          <span className="stat-label">Öffnungen (seit v1.4)</span>
        </div>
        <button className={`stat-card ${stats.uncategorized > 0 ? 'stat-action' : ''}`} onClick={() => stats.uncategorized > 0 && window.dispatchEvent(new CustomEvent('bdm-select-uncategorized'))}>
          <span className="stat-num warn">{stats.uncategorized}</span>
          <span className="stat-label">Ohne Kategorie</span>
        </button>
      </div>

      <div className="stats-columns">
        <div className="stats-col">
          <h3><Icon name="chart" size={14} /> Neue Lesezeichen — 12 Wochen</h3>
          <div className="stat-bars" role="img" aria-label={`Aktivität: ${stats.activity.join(', ')}`}>
            {stats.activity.map((n, i) => (
              <div key={i} className="stat-bar-col" title={`Woche ${i + 1}: ${n} neu`}>
                <div className="stat-bar" style={{ height: `${(n / maxActivity) * 100}%`, opacity: n === 0 ? 0.25 : 0.55 + 0.45 * (n / maxActivity) }} />
              </div>
            ))}
          </div>
          <div className="stat-bars-axis"><span>vor 12 Wo.</span><span>jetzt</span></div>

          <h3><Icon name="external" size={14} /> Top-Webseiten</h3>
          <ul className="stat-list">
            {stats.topHosts.map(({ host, count }) => (
              <li key={host}>
                <span className="stat-list-label">{host}</span>
                <span className="stat-list-bar" style={{ width: `${(count / maxHost) * 100}%` }} />
                <span className="stat-list-num">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="stats-col">
          <h3><Icon name="tag" size={14} /> Top-Tags</h3>
          <ul className="stat-list">
            {stats.topTags.map(({ tag, count }) => (
              <li key={tag}>
                <span className="stat-list-label">#{tag}</span>
                <span className="stat-list-bar accent" style={{ width: `${(count / maxTag) * 100}%` }} />
                <span className="stat-list-num">{count}</span>
              </li>
            ))}
          </ul>

          <h3 className="dup-head">
            <Icon name="copy" size={14} /> Dubletten
            {duplicates.length > 0 && (
              <button className="btn small danger dup-clean" onClick={cleanupAll}>
                Alle bereinigen ({duplicates.length})
              </button>
            )}
          </h3>
          {duplicates.length === 0 ? (
            <p className="hint">Keine Dubletten gefunden — der Bestand ist sauber. ✓</p>
          ) : (
            <>
              <p className="hint">
                {duplicates.length} Gruppe{duplicates.length === 1 ? '' : 'n'} gefunden (gleiche URL). Empfehlung: <strong>angepinnt &gt; häufig geöffnet &gt; jünger</strong> bleibt erhalten.
              </p>
              <button className="btn" onClick={() => setDupsOpen((o) => !o)}>
                {dupsOpen ? 'Liste einklappen' : `Gruppen anzeigen (${duplicates.length})`}
              </button>
              {dupsOpen && (
                <ul className="dup-list">
                  {duplicates.map((g) => (
                    <li key={g.key} className="dup-group">
                      <div className="dup-group-head">
                        <span className="dup-key">{g.key || '(ohne Pfad)'}</span>
                        <button className="btn small" onClick={() => cleanup([g.key])}>
                          Bereinigen ({g.bookmarks.length - 1} löschen)
                        </button>
                      </div>
                      <ul>
                        {g.bookmarks.map((b, i) => (
                          <li key={b.id} className={i === 0 ? 'dup-keep' : 'dup-drop'}>
                            <span className="dup-tag">{i === 0 ? 'Behalten' : 'Löschen'}</span>
                            <span className="dup-title" title={b.url}>{b.title}</span>
                            <span className="dup-meta">
                              {hostOf(b.url)}
                              {b.pinned ? ' · angepinnt' : ''}
                              {b.openedCount ? ` · ${b.openedCount}× geöffnet` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
