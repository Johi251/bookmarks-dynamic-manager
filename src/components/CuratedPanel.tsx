import { useMemo } from 'react';
import { CURATED_LINKS } from '../curated';
import type { BookmarksApi } from '../hooks/useBookmarks';
import Icon from './Icon';

/**
 * Kuratierte Empfehlungen großer Link-Datenbanken, die die eigenen Kategorien
 * ergänzen (Wunsch aus der Anforderung: promptbase, freestuff.dev, free-for.dev …).
 */
export default function CuratedPanel({ api }: { api: BookmarksApi }) {
  const existing = useMemo(
    () => new Set(api.state.bookmarks.map((b) => b.url.toLowerCase().replace(/\/$/, ''))),
    [api.state.bookmarks]
  );

  const take = (url: string, title: string) => {
    api.addBookmark({ title, url, tags: ['empfehlung'], categoryIds: [], pinned: false });
  };

  return (
    <section className="curated">
      <h2>
        <Icon name="sparkles" size={17} /> Empfohlene Link-Datenbanken
      </h2>
      <p className="hint">
        Kuratierte Sammlungen, die deine Kategorien gezielt ergänzen. Ein Klick übernimmt den Link samt automatischer
        Kategorisierung in deine Sammlung.
      </p>
      <ul className="curated-list">
        {CURATED_LINKS.map((l) => {
          const isIn = existing.has(l.url.toLowerCase().replace(/\/$/, ''));
          return (
            <li key={l.url} className="curated-card">
              <div className="curated-head">
                <a href={l.url} target="_blank" rel="noreferrer noopener">
                  {l.title}
                </a>
                <span className="chip">{l.category}</span>
              </div>
              <p>{l.description}</p>
              <div className="curated-foot">
                <span className="bm-host">{l.url}</span>
                <button className="btn small" disabled={isIn} onClick={() => take(l.url, l.title)}>
                  {isIn ? 'Vorhanden' : '+ Übernehmen'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
