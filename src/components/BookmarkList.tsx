import type { Bookmark } from '../types';
import type { BookmarksApi } from '../hooks/useBookmarks';
import type { CrossLinkTarget } from '../crosslink';
import Icon from './Icon';
import Favicon from './Favicon';
import ClickerBadge from './ClickerBadge';

interface Props {
  bookmarks: Bookmark[];
  /** Über das Glossar verknüpfte Links (nur bei Kategorie-/Gruppen-Auswahl). */
  crossLinked?: { bookmark: Bookmark; via: CrossLinkTarget[] }[];
  crossContextName?: string;
  total: number;
  api: BookmarksApi;
  onEdit: (id: string) => void;
  onDemo: () => void;
  onSelectTag: (tag: string) => void;
  onSelectCategory: (categoryId: string) => void;
  /** 1Clicker: 🔵 Badge-Klick → Dialog für lokale Bereitstellung. */
  onDeploy: (bookmarkId: string) => void;
  compact?: boolean;
  checked?: Set<string>;
  onCheck?: (id: string) => void;
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

export default function BookmarkList({
  bookmarks,
  crossLinked = [],
  crossContextName,
  total,
  api,
  onEdit,
  onDemo,
  onSelectTag,
  onSelectCategory,
  onDeploy,
  compact = false,
  checked, onCheck,
}: Props) {
  const catById = new Map(api.state.categories.map((c) => [c.id, c]));

  if (total === 0) {
    return (
      <section className="empty">
        <h2>Noch keine Lesezeichen</h2>
        <p>
          Importiere deine bestehenden Lesezeichen aus Chrome, Firefox oder Brave (Menü → Lesezeichen → Lesezeichen
          exportieren / als HTML speichern) über <strong>Import</strong>.
        </p>
        <p>Oder lade zuerst generische Beispieldaten:</p>
        <button className="btn primary" onClick={onDemo}>
          Beispieldaten laden
        </button>
      </section>
    );
  }

  if (bookmarks.length === 0 && crossLinked.length === 0) {
    return (
      <section className="empty">
        <h2>Keine Treffer</h2>
        <p>Für diese Auswahl gibt es keine Lesezeichen — Suche oder Filter anpassen.</p>
      </section>
    );
  }

  return (
    <section className="bm-list" aria-label="Lesezeichenliste">
      {!compact && (
        <div className="list-meta">
          {bookmarks.length} von {total} Lesezeichen · Angepinnt zuerst, dann jüngstes zuerst
          {crossLinked.length > 0 && <> · {crossLinked.length} verknüpft</>}
        </div>
      )}
      <ul>
        {bookmarks.map((bm, i) => (
          <BmRow
            key={bm.id}
            checked={checked?.has(bm.id)} onCheck={onCheck}
            bm={bm}
            index={i}
            catById={catById}
            api={api}
            onEdit={onEdit}
            onSelectTag={onSelectTag}
            onSelectCategory={onSelectCategory}
            onDeploy={onDeploy}
            compact={compact}
          />
        ))}
      </ul>
      {crossLinked.length > 0 && (
        <>
          <h3 className="cross-head">
            <Icon name="link" size={14} /> Verknüpft über Glossar{crossContextName ? ` — passt zu „${crossContextName}"` : ''}
          </h3>
          <ul>
            {crossLinked.map(({ bookmark: bm, via }, i) => (
              <BmRow
                key={`x-${bm.id}`}
                checked={checked?.has(bm.id)} onCheck={onCheck}
                bm={bm}
                index={i}
                catById={catById}
                api={api}
                onEdit={onEdit}
                onSelectTag={onSelectTag}
                onSelectCategory={onSelectCategory}
                onDeploy={onDeploy}
                compact={compact}
                viaTerms={[...new Set(via.flatMap((v) => v.via))]}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function BmRow({
  bm,
  index,
  catById,
  api,
  onEdit,
  onSelectTag,
  onSelectCategory,
  onDeploy,
  compact,
  viaTerms, checked, onCheck,
}: {
  bm: Bookmark;
  index: number;
  catById: Map<string, { id: string; name: string }>;
  api: BookmarksApi;
  onEdit: (id: string) => void;
  onSelectTag: (tag: string) => void;
  onSelectCategory: (categoryId: string) => void;
  onDeploy: (bookmarkId: string) => void;
  compact: boolean;
  viaTerms?: string[];
  checked?: boolean;
  onCheck?: (id: string) => void;
}) {
  const host = hostOf(bm.url);
  const isLinked = Boolean(viaTerms);
  return (
    <li
      className={`bm-card ${bm.pinned ? 'pinned' : ''} ${isLinked ? 'is-cross' : ''} ${compact ? 'compact' : ''}`}
      style={{ '--i': Math.min(index, 14) } as React.CSSProperties}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/bdm-bookmark', bm.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      title="Ziehen, um den Link einer Kategorie zuzuordnen"
    >
      {checked !== undefined && <input type="checkbox" aria-label={`${bm.title} auswählen`} checked={checked} onChange={() => onCheck?.(bm.id)} />}
      {!compact && (
        <Favicon url={bm.url} title={bm.title} enabled={api.state.settings.faviconsEnabled} />
      )}
      <div className="bm-body">
        <div className="bm-title-row">
          <a className="bm-title" onClick={() => api.markOpened(bm.id)} href={bm.url} target="_blank" rel="noreferrer noopener">
            {bm.title}
          </a>
          {bm.clicker && (
            <ClickerBadge
              bookmarkId={bm.id}
              clicker={bm.clicker}
              onOnline={(u) => { api.markOpened(bm.id); window.open(u, '_blank', 'noopener'); }}
              onLocal={onDeploy}
              compact={compact}
            />
          )}
        </div>
        <div className="bm-sub">
          <span className="bm-host">{host}</span> · <span className="bm-date">{formatDate(bm.added)}</span>
          {bm.tags.length > 0 && (
            <span className="bm-tags">
              {' '}
              {bm.tags.slice(0, compact ? 3 : 8).map((t) => (
                <button key={t} className="tag-btn" onClick={() => onSelectTag(t)} title={`Nach #${t} filtern`}>
                  #{t}
                </button>
              ))}
            </span>
          )}
        </div>
        {!compact && bm.categoryIds.length > 0 && (
          <div className="bm-cats">
            {bm.categoryIds.map((id) => (
              <button key={id} className="chip" onClick={() => onSelectCategory(id)} title="Kategorie öffnen">
                {catById.get(id)?.name ?? '?'}
              </button>
            ))}
          </div>
        )}
        {viaTerms && viaTerms.length > 0 && (
          <div className="bm-crossline">
            <Icon name="link" size={12} /> via {viaTerms.join(' · ')}
          </div>
        )}
      </div>
      <div className="bm-actions">
        <button className="btn icon" title={bm.pinned ? 'Loslösen' : 'Anpinnen'} onClick={() => api.togglePin(bm.id)}>
          <Icon name="pin" size={15} className={bm.pinned ? 'pin-on' : ''} />
        </button>
        {!compact && (
          <button className="btn icon" title="Bearbeiten" onClick={() => onEdit(bm.id)}>
            <Icon name="edit" size={15} />
          </button>
        )}
        <button
          className="btn icon"
          title="Löschen"
          onClick={() => {
            if (confirm(`„${bm.title}" wirklich löschen?`)) api.removeBookmark(bm.id);
          }}
        >
          <Icon name="trash" size={15} />
        </button>
      </div>
    </li>
  );
}
