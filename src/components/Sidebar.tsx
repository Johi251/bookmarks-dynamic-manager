import { useMemo } from 'react';
import type { AppState, Category, Selection, SmartViewKey } from '../types';
import { SMART_VIEWS } from '../types';
import type { BookmarksApi } from '../hooks/useBookmarks';
import { downloadFile, exportJson, exportMarkdown, exportNetscapeHtml } from '../exporter';

interface Props {
  selection: Selection;
  onSelect: (s: Selection) => void;
  api: BookmarksApi;
}

export default function Sidebar({ selection, onSelect, api }: Props) {
  const counts = useMemo(() => computeCounts(api.state), [api.state]);
  const active = (s: Selection): boolean => {
    if (s.type !== selection.type) return false;
    if (s.type === 'smart' && selection.type === 'smart') return s.key === selection.key;
    if (s.type === 'category' && selection.type === 'category') return s.categoryId === selection.categoryId;
    return s.type === 'all';
  };

  const roots = api.state.categories.filter((c) => c.parentId === null);

  return (
    <nav className="sidebar-nav" aria-label="Kategorien und Sammlungen">
      <div className="side-section">
        <button className={`side-item ${active({ type: 'all' }) ? 'active' : ''}`} onClick={() => onSelect({ type: 'all' })}>
          <span className="icon">📚</span> Alle Lesezeichen <span className="count">{counts.total}</span>
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
            <span className="icon">{v.icon}</span> {v.label} <span className="count">{counts.smart[v.key]}</span>
          </button>
        ))}
      </div>

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
  level,
}: {
  cat: Category;
  allCategories: Category[];
  counts: Map<string, number>;
  active: (s: Selection) => boolean;
  onSelect: (s: Selection) => void;
  level: number;
}) {
  const children = allCategories.filter((c) => c.parentId === cat.id);
  return (
    <li>
      <button
        className={`side-item ${active({ type: 'category', categoryId: cat.id }) ? 'active' : ''}`}
        style={{ paddingLeft: `${8 + level * 14}px` }}
        onClick={() => onSelect({ type: 'category', categoryId: cat.id })}
      >
        <span className="icon">📁</span> {cat.name} <span className="count">{counts.get(cat.id) ?? 0}</span>
      </button>
      {children.length > 0 && (
        <ul className="cat-tree">
          {children.map((c) => (
            <CatNode key={c.id} cat={c} allCategories={allCategories} counts={counts} active={active} onSelect={onSelect} level={level + 1} />
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

function computeCounts(state: AppState): { perCat: Map<string, number>; smart: Record<SmartViewKey, number>; total: number } {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = Date.now() - 7 * 86_400_000;
  const catById = new Map(state.categories.map((c) => [c.id, c]));
  const perCat = new Map<string, number>();
  const smart: Record<SmartViewKey, number> = { today: 0, week: 0, github: 0, ki: 0, pinned: 0, uncategorized: 0 };

  const childrenOf = new Map<string, string[]>();
  for (const c of state.categories) {
    if (c.parentId) childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c.id]);
  }
  const deepIds = (id: string): string[] => [id, ...(childrenOf.get(id) ?? []).flatMap(deepIds)];

  for (const bm of state.bookmarks) {
    for (const id of bm.categoryIds) {
      for (const hit of deepIds(id)) perCat.set(hit, (perCat.get(hit) ?? 0) + 1);
    }
    if (bm.added >= dayStart.getTime()) smart.today++;
    if (bm.added >= weekStart) smart.week++;
    if (/github\.com$/i.test(hostOf(bm.url))) smart.github++;
    if (bm.categoryIds.some((id) => (catById.get(id)?.name ?? '').toLowerCase().startsWith('ki'))) smart.ki++;
    if (bm.pinned) smart.pinned++;
    if (bm.categoryIds.length === 0) smart.uncategorized++;
  }
  return { perCat, smart, total: state.bookmarks.length };
}
