import type { Bookmark } from '../types';
import type { BookmarksApi } from '../hooks/useBookmarks';

interface Props {
  bookmarks: Bookmark[];
  total: number;
  api: BookmarksApi;
  onEdit: (id: string) => void;
  onDemo: () => void;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Deterministische Farbe aus dem Hostnamen (keine externen Favicon-Anfragen — Privatsphäre). */
function hueOf(host: string): number {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) % 360;
  return h;
}

export default function BookmarkList({ bookmarks, total, api, onEdit, onDemo }: Props) {
  const catById = new Map(api.state.categories.map((c) => [c.id, c]));

  if (total === 0) {
    return (
      <section className="empty">
        <h2>Noch keine Lesezeichen</h2>
        <p>
          Importiere deine bestehenden Lesezeichen aus Chrome, Firefox oder Brave (Menü → Lesezeichen → Lesezeichen
          exportieren / als HTML speichern) über <strong>⬆ Import</strong>.
        </p>
        <p>Oder lade zuerst generische Beispieldaten:</p>
        <button className="btn primary" onClick={onDemo}>
          🧪 Beispieldaten laden
        </button>
      </section>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <section className="empty">
        <h2>Keine Treffer</h2>
        <p>Für diese Auswahl gibt es keine Lesezeichen — Suche oder Filter anpassen.</p>
      </section>
    );
  }

  return (
    <section className="bm-list" aria-label="Lesezeichenliste">
      <div className="list-meta">
        {bookmarks.length} von {total} Lesezeichen · sortiert: Angepinnt zuerst, dann jüngstes zuerst
      </div>
      <ul>
        {bookmarks.map((bm) => {
          const host = hostOf(bm.url);
          return (
            <li key={bm.id} className={`bm-card ${bm.pinned ? 'pinned' : ''}`}>
              <span className="bm-avatar" style={{ background: `hsl(${hueOf(host)} 65% 45%)` }} aria-hidden="true">
                {(bm.title[0] ?? host[0] ?? '?').toUpperCase()}
              </span>
              <div className="bm-body">
                <a className="bm-title" href={bm.url} target="_blank" rel="noreferrer noopener">
                  {bm.pinned && '📌 '}
                  {bm.title}
                </a>
                <div className="bm-sub">
                  <span className="bm-host">{host}</span> · {formatDate(bm.added)}
                  {bm.tags.length > 0 && <span className="bm-tags"> {bm.tags.map((t) => `#${t}`).join(' ')}</span>}
                </div>
                <div className="bm-cats">
                  {bm.categoryIds.map((id) => (
                    <button key={id} className="chip" onClick={() => undefined} title="Kategorie">
                      {catById.get(id)?.name ?? '?'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bm-actions">
                <button className="btn icon" title={bm.pinned ? 'Loslösen' : 'Anpinnen'} onClick={() => api.togglePin(bm.id)}>
                  {bm.pinned ? '📍' : '📌'}
                </button>
                <button className="btn icon" title="Bearbeiten" onClick={() => onEdit(bm.id)}>
                  ✏️
                </button>
                <button
                  className="btn icon"
                  title="Löschen"
                  onClick={() => {
                    if (confirm(`„${bm.title}" wirklich löschen?`)) api.removeBookmark(bm.id);
                  }}
                >
                  🗑️
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
