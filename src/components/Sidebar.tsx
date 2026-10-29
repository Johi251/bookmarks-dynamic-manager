import { useMemo, useState } from 'react';
import type { AppState, Category, Selection, SmartViewKey } from '../types';
import { APP_VERSION, SMART_VIEWS } from '../types';
import type { BookmarksApi } from '../hooks/useBookmarks';
import { downloadFile, exportJson, exportMarkdown, exportNetscapeHtml } from '../exporter';
import Icon from './Icon';
import { bookmarkMatchesGroup, termsFromName } from '../groups';
import { glossaryMainGroups } from '../glossary';
import { describeNewCrossLinks } from '../crosslink';

interface Props {
  selection: Selection;
  onSelect: (s: Selection) => void;
  api: BookmarksApi;
  notify: (text: string, kind?: 'ok' | 'info' | 'warn', detail?: string) => void;
}

export default function Sidebar({ selection, onSelect, api, notify }: Props) {
  const [groupDraft, setGroupDraft] = useState('');
  const [showAllTags, setShowAllTags] = useState(false);
  const counts = useMemo(() => computeCounts(api.state), [api.state]);
  const tagCounts = useMemo(() => computeTagCounts(api.state), [api.state]);

  const active = (s: Selection): boolean => {
    if (s.type !== selection.type) return false;
    if (s.type === 'smart' && selection.type === 'smart') return s.key === selection.key;
    if (s.type === 'category' && selection.type === 'category') return s.categoryId === selection.categoryId;
    if (s.type === 'tag' && selection.type === 'tag') return s.tag === selection.tag;
    if (s.type === 'group' && selection.type === 'group') return s.groupId === selection.groupId;
    return s.type === 'all';
  };

  const roots = api.state.categories.filter((c) => c.parentId === null);
  const glossaryGroups = useMemo(() => glossaryMainGroups(api.state.glossary, api.state.categories), [api.state]);

  const dropOnCategory = (e: React.DragEvent, categoryId: string, name: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const bookmarkId = e.dataTransfer.getData('text/bdm-bookmark');
    if (!bookmarkId) return;
    const bm = api.state.bookmarks.find((b) => b.id === bookmarkId);
    if (!bm) return;
    if (bm.categoryIds.includes(categoryId)) {
      notify(`Bereits in „${name}"`, 'info');
      return;
    }
    api.assignToCategory(bookmarkId, categoryId);
    const next = { ...api.state, bookmarks: api.state.bookmarks.map((b) => (b.id === bookmarkId ? { ...b, categoryIds: [...b.categoryIds, categoryId] } : b)) };
    const cross = describeNewCrossLinks({ ...bm, categoryIds: [...bm.categoryIds, categoryId] }, next);
    notify(`„${bm.title}" → ${name}`, 'ok', cross ? `Verknüpft mit: ${cross}` : undefined);
  };

  const dropOnGroup = (e: React.DragEvent, groupId: string, name: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const bookmarkId = e.dataTransfer.getData('text/bdm-bookmark');
    if (!bookmarkId) return;
    const bm = api.state.bookmarks.find((b) => b.id === bookmarkId);
    const group = api.state.dynamicGroups.find((g) => g.id === groupId);
    if (!bm || !group) return;
    let added = 0;
    for (const t of group.terms) {
      if (t.startsWith('#')) {
        api.addTag(bookmarkId, t.slice(1));
        added++;
      }
    }
    if (added > 0) notify(`„${bm.title}" → ${name}`, 'ok', `${added} Gruppen-Tag(s) ergänzt`);
    else notify(`Gruppe „${name}" matcht Text — kein Tag nötig, Link passt bereits oder wird über den Text gefunden.`, 'info');
  };

  const addGroup = () => {
    const name = groupDraft.trim();
    if (!name) return;
    api.addDynamicGroup(name, termsFromName(name));
    notify(`Dynamische Gruppe „${name}" angelegt`, 'ok', 'Scannt den Bestand automatisch.');
    setGroupDraft('');
  };

  const topTags = showAllTags ? tagCounts : tagCounts.slice(0, 8);

  return (
    <nav className="sidebar-nav" aria-label="Kategorien und Sammlungen">
      <div className="side-section">
        <button className={`side-item ${active({ type: 'all' }) ? 'active' : ''}`} onClick={() => onSelect({ type: 'all' })}>
          <Icon name="bookmark" size={15} /> <span className="side-label">Alle Lesezeichen</span> <span className="count">{counts.total}</span>
        </button>
      </div>

      <div className="side-section">
        <h3>Dynamische Sammlungen</h3>
        {SMART_VIEWS.map((v) => (
          <button
            key={v.key}
            className={`side-item ${active({ type: 'smart', key: v.key }) ? 'active' : ''}`}
            onClick={() => onSelect({ type: 'smart', key: v.key })}
          >
            <Icon name={v.icon as 'clock'} size={15} /> <span className="side-label">{v.label}</span> <span className="count">{counts.smart[v.key]}</span>
          </button>
        ))}
      </div>

      <div className="side-section">
        <h3>Dynamische Gruppen · #</h3>
        {api.state.dynamicGroups.length === 0 && (
          <p className="hint">Gruppe mit „#" anlegen (z. B. <strong>#TOP KI</strong>) — sie sammelt passende Links automatisch ein.</p>
        )}
        {api.state.dynamicGroups.map((g) => {
          const members = api.state.bookmarks.filter((b) => bookmarkMatchesGroup(b, g, api.state.categories)).length;
          return (
            <div key={g.id} className="side-item-row">
              <button
                className={`side-item ${active({ type: 'group', groupId: g.id }) ? 'active' : ''}`}
                onClick={() => onSelect({ type: 'group', groupId: g.id })}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('drag-over');
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                onDrop={(e) => dropOnGroup(e, g.id, g.name)}
                title={`Matcht: ${g.terms.join(', ')}`}
              >
                <Icon name="hash" size={15} /> <span className="side-label">{g.name}</span> <span className="count">{members}</span>
              </button>
              <button className="side-del" title="Gruppe löschen" onClick={() => api.removeDynamicGroup(g.id)}>
                <Icon name="x" size={12} />
              </button>
            </div>
          );
        })}
        <div className="side-input-row">
          <input
            type="text"
            placeholder="#Gruppe anlegen …"
            value={groupDraft}
            onChange={(e) => setGroupDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGroup()}
            aria-label="Neue dynamische Gruppe"
          />
        </div>
      </div>

      {tagCounts.length > 0 && (
        <div className="side-section">
          <h3>Tags</h3>
          <div className="tag-cloud">
            {topTags.map(([tag, n]) => (
              <button key={tag} className={`tag-chip ${active({ type: 'tag', tag }) ? 'active' : ''}`} onClick={() => onSelect({ type: 'tag', tag })}>
                #{tag} <span>{n}</span>
              </button>
            ))}
          </div>
          {tagCounts.length > 8 && (
            <button className="link-btn small-link" onClick={() => setShowAllTags((s) => !s)}>
              {showAllTags ? 'weniger' : `alle ${tagCounts.length} anzeigen`}
            </button>
          )}
        </div>
      )}

      {glossaryGroups.length > 0 && (
        <div className="side-section">
          <h3>Glossar-Hauptgruppen</h3>
          {glossaryGroups.map((g) => {
            const cat = api.state.categories.find((c) => c.name.toLowerCase() === g.term.toLowerCase());
            if (!cat) return null;
            return (
              <button
                key={g.id}
                className={`side-item ${active({ type: 'category', categoryId: cat.id }) ? 'active' : ''}`}
                onClick={() => onSelect({ type: 'category', categoryId: cat.id })}
                title={g.related.join(' · ')}
              >
                <Icon name="target" size={15} /> <span className="side-label">{g.term}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="side-section grow">
        <h3>Kategorien</h3>
        {roots.length === 0 && <p className="hint">Noch keine Kategorien — einfach Lesezeichen importieren oder hinzufügen.</p>}
        <ul className="cat-tree">
          {roots.map((c) => (
            <CatNode
              key={c.id}
              cat={c}
              allCategories={api.state.categories}
              counts={counts.perCat}
              active={active}
              onSelect={onSelect}
              onDropCategory={dropOnCategory}
              favorites={api.state.settings.favorites}
              onToggleFavorite={(id) => api.toggleFavorite(id)}
              level={0}
            />
          ))}
        </ul>
      </div>

      <div className="side-section">
        <h3>Export</h3>
        <div className="export-row">
          <button className="btn small" onClick={() => downloadFile('bookmarks-backup.json', exportJson(api.state), 'application/json')}>
            JSON
          </button>
          <button className="btn small" onClick={() => downloadFile('bookmarks.html', exportNetscapeHtml(api.state), 'text/html')}>
            Browser-HTML
          </button>
          <button className="btn small" onClick={() => downloadFile('bookmarks.md', exportMarkdown(api.state), 'text/markdown')}>
            Markdown
          </button>
        </div>
        <button
          className="btn small danger"
          onClick={() => {
            if (confirm('Wirklich ALLE Lesezeichen und Kategorien löschen? (Export vorher möglich)')) api.resetAll();
          }}
        >
          Alles zurücksetzen
        </button>
        <p className="version">v{APP_VERSION}</p>
      </div>
    </nav>
  );
}

function CatNode({
  cat,
  allCategories,
  counts,
  active,
  onSelect,
  onDropCategory,
  favorites,
  onToggleFavorite,
  level,
}: {
  cat: Category;
  allCategories: Category[];
  counts: Map<string, number>;
  active: (s: Selection) => boolean;
  onSelect: (s: Selection) => void;
  onDropCategory: (e: React.DragEvent, categoryId: string, name: string) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  level: number;
}) {
  const children = allCategories.filter((c) => c.parentId === cat.id);
  const isFav = favorites.includes(cat.id);
  return (
    <li className="cat-node">
      <div className="cat-row">
        <button
          className={`side-item ${active({ type: 'category', categoryId: cat.id }) ? 'active' : ''}`}
          style={{ paddingLeft: `${8 + level * 14}px` }}
          onClick={() => onSelect({ type: 'category', categoryId: cat.id })}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over');
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
          onDrop={(e) => onDropCategory(e, cat.id, cat.name)}
          title="Link per Drag & Drop hier ablegen"
        >
          <Icon name="folder" size={15} /> <span className="side-label">{cat.name}</span> <span className="count">{counts.get(cat.id) ?? 0}</span>
        </button>
        <button
          className={`fav-toggle ${isFav ? 'on' : ''}`}
          title={isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten (Kompaktmodus-Leiste) hinzufügen'}
          onClick={() => onToggleFavorite(cat.id)}
        >
          <Icon name="star" size={13} />
        </button>
      </div>
      {children.length > 0 && (
        <ul className="cat-tree">
          {children.map((c) => (
            <CatNode key={c.id} cat={c} allCategories={allCategories} counts={counts} active={active} onSelect={onSelect} onDropCategory={onDropCategory} favorites={favorites} onToggleFavorite={onToggleFavorite} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function computeTagCounts(state: AppState): [string, number][] {
  const m = new Map<string, number>();
  for (const bm of state.bookmarks) {
    for (const t of bm.tags) m.set(t, (m.get(t) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function computeCounts(state: AppState): { perCat: Map<string, number>; smart: Record<SmartViewKey, number>; total: number } {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = Date.now() - 7 * 86_400_000;
  const catById = new Map(state.categories.map((c) => [c.id, c]));
  const perCat = new Map<string, number>();
  const smart: Record<SmartViewKey, number> = { hunt: 0, today: 0, week: 0, recent: 0, github: 0, ki: 0, pinned: 0, uncategorized: 0, 'clicker-online': 0, 'clicker-local': 0 };

  for (const bm of state.bookmarks) {
    const ancestors = new Set<string>();
    for (const id of bm.categoryIds) {
      let current: string | null = id;
      while (current && !ancestors.has(current)) {
        ancestors.add(current); current = catById.get(current)?.parentId ?? null;
      }
    }
    for (const id of ancestors) perCat.set(id, (perCat.get(id) ?? 0) + 1);
    if (bm.lastOpenedAt) smart.recent++;
    if (bm.source === 'copyNpaste' && (bm.capturedAt ?? 0) >= dayStart.getTime()) smart.hunt++;
    if (bm.added >= dayStart.getTime()) smart.today++;
    if (bm.added >= weekStart) smart.week++;
    if (/github\.com$/i.test(hostOf(bm.url))) smart.github++;
    if (bm.categoryIds.some((id) => (catById.get(id)?.name ?? '').toLowerCase().startsWith('ki'))) smart.ki++;
    if (bm.pinned) smart.pinned++;
    if (bm.categoryIds.length === 0) smart.uncategorized++;
    if (bm.clicker?.status === 'online') smart['clicker-online']++;
    if (bm.clicker?.status === 'local') smart['clicker-local']++;
  }
  return { perCat, smart, total: state.bookmarks.length };
}
