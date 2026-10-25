import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { Selection } from './types';
import { useBookmarks } from './hooks/useBookmarks';
import { crossLinksForBookmark } from './crosslink';
import { bookmarkMatchesGroup } from './groups';
import { CLICKER_QUEUE_DELAY_MS, CLICKER_SESSION_LIMIT, needsCheck, refineRepo } from './oneclicker';
import { ensureWeeklyBackup } from './backup';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import BookmarkList from './components/BookmarkList';
import CuratedPanel from './components/CuratedPanel';
import RulesDialog from './components/RulesDialog';
import AddDialog from './components/AddDialog';
import ImportDialog from './components/ImportDialog';
import GlossaryDialog from './components/GlossaryDialog';
import GlossaryLearnDialog from './components/GlossaryLearnDialog';
import SettingsDialog from './components/SettingsDialog';
import CommandPalette from './components/CommandPalette';
import ClickerDialog from './components/ClickerDialog';
const VideoStudio = lazy(() => import('./components/VideoStudio'));
import Icon from './components/Icon';
import { ToastHost, useToasts } from './components/Toasts';
import type { TermCandidate } from './ai/engine';
import { formatShortcut, loadShortcut, matchesShortcut, storeShortcut, type ShortcutCombo } from './shortcut';

type MainTab = 'bookmarks' | 'curated';

export default function App() {
  const api = useBookmarks();
  const { toasts, push } = useToasts();
  const [selection, setSelection] = useState<Selection>({ type: 'all' });
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<MainTab>('bookmarks');
  const [editing, setEditing] = useState<{ open: boolean; id?: string }>({ open: false });
  const [showImport, setShowImport] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [learnCandidates, setLearnCandidates] = useState<TermCandidate[] | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [deployId, setDeployId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [quickOpen, setQuickOpen] = useState<string | null>(null); // gewählte Favoriten-Kategorie im Kompaktmodus
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    localStorage.getItem('bdm-theme') === 'light' ? 'light' : 'dark'
  );
  const [shortcut, setShortcut] = useState<ShortcutCombo>(() => loadShortcut());

  // Erst wenn der persistierte Zustand geladen ist: Kompaktstart-Einstellung respektieren.
  useEffect(() => {
    if (api.ready) setMinimized(api.state.settings.startMinimized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.ready]);

  // Wöchentliche lokale Auto-Sicherung prüfen (IndexedDB-Snapshots).
  useEffect(() => {
    if (!api.ready) return;
    void ensureWeeklyBackup(api.state).then((snap) => {
      if (snap) console.info(`Auto-Backup angelegt: ${snap.date} (${snap.bookmarkCount} Lesezeichen)`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.ready]);

  // 1Clicker-Hintergrund-Queue: Repositories gedrosselt über die GitHub-API
  // verfeinern (Session-Limit beachten); Ergebnisse landen auf dem Lesezeichen.
  const refinedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!api.ready || !api.state.settings.clickerEnabled) return;
    const queue = api.state.bookmarks.filter(
      (b) => b.clicker?.repo && needsCheck(b) && !refinedIds.current.has(b.id)
    );
    if (queue.length === 0) return;
    let cancelled = false;
    let done = 0;
    const run = async () => {
      for (const bm of queue) {
        if (cancelled || done >= CLICKER_SESSION_LIMIT) return;
        refinedIds.current.add(bm.id);
        done++;
        await new Promise((r) => setTimeout(r, CLICKER_QUEUE_DELAY_MS));
        if (cancelled) return;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12_000);
          const refined = await refineRepo(bm.clicker!, controller.signal);
          clearTimeout(timer);
          if (!cancelled) api.updateBookmark(bm.id, { clicker: refined });
        } catch {
          /* offline/Rate-Limit → Status bleibt „checking", nächster Start probiert erneut */
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.ready, api.state.settings.clickerEnabled, api.state.bookmarks.length]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('bdm-theme', next);
  };

  // Palette-Kommando „Design umschalten"
  useEffect(() => {
    const handler = () => toggleTheme();
    document.addEventListener('bdm-toggle-theme', handler);
    return () => document.removeEventListener('bdm-toggle-theme', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Konfigurierbares Shortcut-Fenster (Standard Strg+F) — global, auch in Eingabefeldern.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchesShortcut(e, shortcut)) {
        e.preventDefault();
        setShowPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut]);

  const notify = push;

  const { direct, crossLinked, crossContextName } = useMemo(() => {
    const catById = new Map(api.state.categories.map((c) => [c.id, c]));
    const groupById = new Map(api.state.dynamicGroups.map((g) => [g.id, g]));
    const catName = (id: string) => catById.get(id)?.name ?? '';
    const q = query.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/) : [];
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = Date.now() - 7 * 86_400_000;

    const matchesSelection = (bm: (typeof api.state.bookmarks)[number]): boolean => {
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
          case 'clicker-online':
            if (bm.clicker?.status !== 'online') return false;
            break;
          case 'clicker-local':
            if (bm.clicker?.status !== 'local') return false;
            break;
        }
      } else if (selection.type === 'category') {
        if (!isInCategory(bm, selection.categoryId, api.state.categories)) return false;
      } else if (selection.type === 'tag') {
        if (!bm.tags.some((t) => t.toLowerCase() === selection.tag.toLowerCase())) return false;
      } else if (selection.type === 'group') {
        const group = groupById.get(selection.groupId);
        if (!group || !bookmarkMatchesGroup(bm, group, api.state.categories)) return false;
      }
      return true;
    };

    const matchesQuery = (bm: (typeof api.state.bookmarks)[number]): boolean => {
      if (tokens.length === 0) return true;
      const hay = `${bm.title} ${bm.url} ${bm.tags.join(' ')} ${bm.categoryIds.map(catName).join(' ')}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    };

    let list = api.state.bookmarks.filter((bm) => matchesSelection(bm) && matchesQuery(bm));

    // Sortierung: angepinnt zuerst, dann stets jüngstes zuerst.
    list = [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.added - a.added);

    // Cross-Verlinkung: bei Kategorie-/Gruppen-Auswahl zusätzlich über Glossar
    // verbundene Links anzeigen (kein Duplikat der direkten Zuordnung).
    let cross: { bookmark: (typeof api.state.bookmarks)[number]; via: ReturnType<typeof crossLinksForBookmark> }[] = [];
    let contextName: string | undefined;
    if (selection.type === 'category' || selection.type === 'group') {
      const targetKind = selection.type === 'category' ? 'category' : 'group';
      const targetId = selection.type === 'category' ? selection.categoryId : selection.groupId;
      contextName = targetKind === 'category' ? catById.get(targetId)?.name : groupById.get(targetId)?.name;
      const directIds = new Set(list.map((b) => b.id));
      cross = api.state.bookmarks
        .filter((bm) => !directIds.has(bm.id) && matchesQuery(bm))
        .map((bm) => ({ bookmark: bm, via: crossLinksForBookmark(bm, api.state).filter((t) => t.kind === targetKind && t.id === targetId) }))
        .filter((x) => x.via.length > 0)
        .sort((a, b) => Number(b.bookmark.pinned) - Number(a.bookmark.pinned) || b.bookmark.added - a.bookmark.added);
    }

    return { direct: list, crossLinked: cross, crossContextName: contextName };
  }, [api.state, query, selection]);

  const favCats = useMemo(
    () =>
      api.state.settings.favorites
        .map((id) => api.state.categories.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [api.state]
  );

  const quickList = useMemo(() => {
    if (quickOpen) {
      return api.state.bookmarks
        .filter((bm) => isInCategory(bm, quickOpen, api.state.categories))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.added - a.added)
        .slice(0, 30);
    }
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return api.state.bookmarks
      .filter((b) => `${b.title} ${b.url} ${b.tags.join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => b.added - a.added)
      .slice(0, 30);
  }, [quickOpen, query, api.state]);

  const shortcutLabel = formatShortcut(shortcut);

  // ── Kompaktmodus: schlanke Schnellzugriffs-Leiste ──
  if (minimized) {
    const quickCat = quickOpen ? api.state.categories.find((c) => c.id === quickOpen) : null;
    return (
      <div className="app compact-app" data-theme={theme}>
        <header className="quickbar">
          <span className="brand" aria-hidden="true">
            <Icon name="bookmark" size={16} />
          </span>
          <div className="quick-favs">
            {favCats.length === 0 && <span className="hint">Favoriten-Kategorien in den Einstellungen oder per ☆ an Kategorien festlegen</span>}
            {favCats.map((c) => (
              <button key={c.id} className={`quick-chip ${quickOpen === c.id ? 'active' : ''}`} onClick={() => setQuickOpen((o) => (o === c.id ? null : c.id))}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="search-wrap quick-search">
            <Icon name="search" size={13} className="search-icon" />
            <input
              className="search"
              type="search"
              placeholder="Schnellsuche …"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setQuickOpen(null);
              }}
              aria-label="Schnellsuche"
            />
          </div>
          <button className="btn icon" title={`Schnellzugriff (${shortcutLabel})`} onClick={() => setShowPalette(true)}>
            <Icon name="command" size={15} />
          </button>
          <button className="btn icon" title="Hinzufügen" onClick={() => setEditing({ open: true })}>
            <Icon name="plus" size={15} />
          </button>
          <button className="btn icon" title="Vollansicht öffnen" onClick={() => setMinimized(false)}>
            <Icon name="maximize" size={15} />
          </button>
        </header>
        {(quickCat || query.trim()) && (
          <main className="quick-panel">
            <div className="list-meta">
              {quickCat ? quickCat.name : 'Suchergebnisse'} · {quickList.length} Treffer
            </div>
            <BookmarkList
              bookmarks={quickList}
              total={api.state.bookmarks.length}
              api={api}
              onEdit={(id) => setEditing({ open: true, id })}
              onDemo={api.loadDemo}
              onSelectTag={(t) => setSelection({ type: 'tag', tag: t })}
              onSelectCategory={(id) => setQuickOpen(id)}
              onDeploy={setDeployId}
              compact
            />
          </main>
        )}
        {editing.open && (
          <AddDialog
            api={api}
            bookmark={editing.id ? api.state.bookmarks.find((b) => b.id === editing.id) : undefined}
            onClose={() => setEditing({ open: false })}
          />
        )}
        {showPalette && (
          <CommandPalette api={api} onClose={() => setShowPalette(false)} onSelect={(s) => { setSelection(s); setMinimized(false); setTab('bookmarks'); }} notify={notify} />
        )}
        <ToastHost toasts={toasts} />
      </div>
    );
  }

  // ── Vollansicht ──
  return (
    <div className="app" data-theme={theme}>
      <header className="topbar">
        <div className="brand" aria-hidden="true">
          <Icon name="bookmark" size={18} />
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
          minimized={minimized}
          onToggleMinimized={() => setMinimized(true)}
          shortcutLabel={shortcutLabel}
          onPalette={() => setShowPalette(true)}
          onAdd={() => setEditing({ open: true })}
          onImport={() => setShowImport(true)}
          onRules={() => setShowRules(true)}
          onGlossary={() => setShowGlossary(true)}
          onVideo={() => setShowVideo(true)}
          onSettings={() => setShowSettings(true)}
        />
      </header>
      <div className="layout">
        <aside className="sidebar">
          <Sidebar selection={selection} onSelect={setSelection} api={api} notify={notify} />
        </aside>
        <main className="main">
          {tab === 'curated' ? (
            <CuratedPanel api={api} />
          ) : (
            <BookmarkList
              bookmarks={direct}
              crossLinked={crossLinked}
              crossContextName={crossContextName}
              total={api.state.bookmarks.length}
              api={api}
              onEdit={(id) => setEditing({ open: true, id })}
              onDemo={api.loadDemo}
              onSelectTag={(t) => setSelection({ type: 'tag', tag: t })}
              onSelectCategory={(id) => setSelection({ type: 'category', categoryId: id })}
              onDeploy={setDeployId}
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
      {showImport && (
        <ImportDialog
          api={api}
          onClose={() => setShowImport(false)}
          notify={notify}
          onLearnGlossary={(candidates) => {
            setShowImport(false);
            setLearnCandidates(candidates);
          }}
        />
      )}
      {showRules && <RulesDialog api={api} onClose={() => setShowRules(false)} />}
      {showGlossary && <GlossaryDialog api={api} onClose={() => setShowGlossary(false)} notify={notify} />}
      {learnCandidates && (
        <GlossaryLearnDialog
          api={api}
          candidates={learnCandidates}
          onClose={() => setLearnCandidates(null)}
          notify={notify}
        />
      )}
      {showSettings && (
        <SettingsDialog
          api={api}
          shortcut={shortcut}
          onShortcutChange={(c) => {
            setShortcut(c);
            storeShortcut(c);
          }}
          onClose={() => setShowSettings(false)}
          notify={notify}
        />
      )}
      {showPalette && <CommandPalette api={api} onClose={() => setShowPalette(false)} onSelect={setSelection} notify={notify} />}
      {showVideo && (
        <VideoStudio api={api} onClose={() => setShowVideo(false)} notify={notify} />
      )}
      {deployId && (
        <ClickerDialog api={api} bookmarkId={deployId} onClose={() => setDeployId(null)} notify={notify} />
      )}
      <ToastHost toasts={toasts} />
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
