import { useMemo, useState } from 'react';
import type { Selection } from './types';
import { useBookmarks } from './hooks/useBookmarks';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import BookmarkList from './components/BookmarkList';
import CuratedPanel from './components/CuratedPanel';
import RulesDialog from './components/RulesDialog';
import AddDialog from './components/AddDialog';
import ImportDialog from './components/ImportDialog';

type MainTab = 'bookmarks' | 'curated';

export default function App() {
  const api = useBookmarks();
  const [selection, setSelection] = useState<Selection>({ type: 'all' });
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<MainTab>('bookmarks');
  const [editing, setEditing] = useState<{ open: boolean; id?: string }>({ open: false });
  const [showImport, setShowImport] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    localStorage.getItem('bdm-theme') === 'light' ? 'light' : 'dark'
  );

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('bdm-theme', next);
  };

  const visible = useMemo(() => {
    const catById = new Map(api.state.categories.map((c) => [c.id, c]));
    const catName = (id: string) => catById.get(id)?.name ?? '';
    const q = query.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/) : [];
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = Date.now() - 7 * 86_400_000;

    let list = api.state.bookmarks.filter((bm) => {
      if (selection.type === 'smart') {
        switch (selection.key) {
          case 'today':
            if (bm.added < dayStart.getTime()) return false;
            break;
          case 'week':
            if (bm.added < weekStart) return false;
            break;
          case 'github':
            if (!/github\.com$/i.test(hostOf(bm.url))) return false;
            break;
          case 'ki':
            if (!bm.categoryIds.some((id) => catName(id).toLowerCase().startsWith('ki'))) return false;
            break;
          case 'pinned':
            if (!bm.pinned) return false;
            break;
          case 'uncategorized':
            if (bm.categoryIds.length > 0) return false;
            break;
        }
      } else if (selection.type === 'category') {
        // Kategorie ausgewählt: Link zählt, wenn er direkt oder in einer Unterkategorie liegt.
        if (!isInCategory(bm, selection.categoryId, api.state.categories)) return false;
      }
      if (tokens.length) {
        const hay = `${bm.title} ${bm.url} ${bm.tags.join(' ')} ${bm.categoryIds.map(catName).join(' ')}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      return true;
    });

    // Sortierung: angepinnt zuerst, dann stets jüngstes zuerst.
    list = [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.added - a.added);
    return list;
  }, [api.state, query, selection]);

  return (
    <div className="app" data-theme={theme}>
      <header className="topbar">
        <div className="brand" role="img" aria-label="Logo">
          🔖
        </div>
        <h1>
          Bookmarks <span>Dynamic Manager</span>
        </h1>
        <Toolbar
          query={query}
          onQuery={setQuery}
          tab={tab}
          onTab={setTab}
          theme={theme}
          onToggleTheme={toggleTheme}
          onAdd={() => setEditing({ open: true })}
          onImport={() => setShowImport(true)}
          onRules={() => setShowRules(true)}
        />
      </header>
      <div className="layout">
        <aside className="sidebar">
          <Sidebar selection={selection} onSelect={setSelection} api={api} />
        </aside>
        <main className="main">
          {tab === 'curated' ? (
            <CuratedPanel api={api} />
          ) : (
            <BookmarkList
              bookmarks={visible}
              total={api.state.bookmarks.length}
              api={api}
              onEdit={(id) => setEditing({ open: true, id })}
              onDemo={api.loadDemo}
            />
          )}
        </main>
      </div>
      {editing.open && (
        <AddDialog
          api={api}
          bookmark={editing.id ? api.state.bookmarks.find((b) => b.id === editing.id) : undefined}
          onClose={() => setEditing({ open: false })}
        />
      )}
      {showImport && <ImportDialog api={api} onClose={() => setShowImport(false)} />}
      {showRules && <RulesDialog api={api} onClose={() => setShowRules(false)} />}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isInCategory(bm: { categoryIds: string[] }, categoryId: string, categories: { id: string; parentId: string | null }[]): boolean {
  const wanted = new Set<string>([categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories) {
      if (c.parentId && wanted.has(c.parentId) && !wanted.has(c.id)) {
        wanted.add(c.id);
        changed = true;
      }
    }
  }
  return bm.categoryIds.some((id) => wanted.has(id));
}
