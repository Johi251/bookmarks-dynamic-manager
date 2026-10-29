import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { SORT_MODES, type Selection, type SortMode } from './types';
import { useBookmarks } from './hooks/useBookmarks';
import { crossLinksForBookmark } from './crosslink';
import { bookmarkMatchesGroup } from './groups';
import { sortBookmarks } from './stats';
import { CLICKER_QUEUE_DELAY_MS, CLICKER_SESSION_LIMIT, needsCheck, refineRepo } from './oneclicker';
import { ensureWeeklyBackup } from './backup';
import { readHunt, acknowledgeHunt, checkAklik } from './integrations';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import BookmarkList from './components/BookmarkList';
import CuratedPanel from './components/CuratedPanel';
import StatsPanel from './components/StatsPanel';
import RulesDialog from './components/RulesDialog';
import AddDialog from './components/AddDialog';
import ImportDialog from './components/ImportDialog';
import GlossaryDialog from './components/GlossaryDialog';
import GlossaryLearnDialog from './components/GlossaryLearnDialog';
import SettingsDialog from './components/SettingsDialog';
import CommandPalette from './components/CommandPalette';
import ClickerDialog from './components/ClickerDialog';
import QuickMenu from './components/QuickMenu';
const VideoStudio = lazy(() => import('./components/VideoStudio'));
import Icon from './components/Icon';
import { ToastHost, useToasts } from './components/Toasts';
import type { TermCandidate } from './ai/engine';
import { formatShortcut, loadShortcut, matchesShortcut, storeShortcut, type ShortcutCombo } from './shortcut';

type MainTab = 'bookmarks' | 'curated' | 'stats';

export default function App() {
  const api = useBookmarks();
  const { toasts, push } = useToasts();
  const [selection, setSelection] = useState<Selection>({ type: 'all' });
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<MainTab>('bookmarks');
  const [sortMode, setSortMode] = useState<SortMode>(() => SORT_MODES.find((m) => m.key === localStorage.getItem('bdm-sort'))?.key ?? 'newest');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [editing, setEditing] = useState<{ open: boolean; id?: string }>({ open: false });
  const [showImport, setShowImport] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [learnCandidates, setLearnCandidates] = useState<TermCandidate[] | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [huntStatus, setHuntStatus] = useState('');
  const [deployId, setDeployId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [quickOpen, setQuickOpen] = useState<string | null>(null); // gewählte Favoriten-Kategorie im Kompaktmodus
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('bdm-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    // Auto-Theme (Standard): Systempräferenz übernehmen.
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  const [shortcut, setShortcut] = useState<ShortcutCombo>(() => loadShortcut());

  // Erst wenn der persistierte Zustand geladen ist: Kompaktstart-Einstellung respektieren.
  useEffect(() => {
    if (api.ready) setMinimized(api.state.settings.startMinimized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.ready]);

  const currentState = useRef(api.state);
  currentState.current = api.state;
  const currentApi = useRef(api);
  currentApi.current = api;
  useEffect(() => {
    if (!api.ready) return;
    let cancelled = false, busy = false;
    const receive = async () => {
      if (busy || cancelled) return;
      busy = true;
      try {
        const result = await readHunt();
        if (cancelled) return;
        setHuntStatus(result.status);
        if (result.items.length) {
          await currentApi.current.acceptHunt(result.items);
          await acknowledgeHunt(result.items.map((item) => item.id));
          push(`${result.items.length} URLs aus copyNpaste übernommen`, 'ok');
        }
      } catch { if (!cancelled) setHuntStatus("Today's Hunt: Empfang fehlgeschlagen. URLs bleiben im Eingang erhalten."); }
      finally { busy = false; }
    };
    void receive();
    const timer = setInterval(() => void receive(), 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [api.ready]);
  useEffect(() => {
    if (!api.ready) return;
    const backup = () => { void ensureWeeklyBackup(currentState.current).catch(() => push('Auto-Sicherung fehlgeschlagen', 'warn', 'Bitte JSON exportieren und den Speicher prüfen.')); };
    backup();
    const timer = window.setInterval(backup, 60_000);
    return () => window.clearInterval(timer);
  }, [api.ready, api.state.settings.autoBackup, api.state.bookmarks.length]);

  // 1Clicker-Hintergrund-Queue: Repositories gedrosselt über die GitHub-API
  // verfeinern (Session-Limit beachten); Ergebnisse landen auf dem Lesezeichen.
  const refinedIds = useRef<Set<string>>(new Set());
  const checkedCount = useRef(0);
  useEffect(() => {
    if (!api.ready || !api.state.settings.clickerEnabled) return;
    const queue = api.state.bookmarks.filter(
      (b) => b.clicker?.repo && needsCheck(b) && !refinedIds.current.has(b.id)
    );
    if (queue.length === 0) return;
    let cancelled = false;
    const run = async () => {
      for (const bm of queue) {
        if (cancelled || checkedCount.current >= CLICKER_SESSION_LIMIT) return;
        await new Promise((r) => setTimeout(r, CLICKER_QUEUE_DELAY_MS));
        if (cancelled) return;
        refinedIds.current.add(bm.id);
        checkedCount.current++;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12_000);
          const refined = await checkAklik(bm.url, bm.clicker!, controller.signal) ?? await refineRepo(bm.clicker!, controller.signal);
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
        return;
      }
      // Undo/Redo — nicht in Texteingaben (dort gehört Strg+Z dem Feld).
      const target = e.target as HTMLElement | null;
      const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (!inField && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) api.redo();
        else api.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut, api]);

  // Sortiermodus persistieren.
  useEffect(() => {
    localStorage.setItem('bdm-sort', sortMode);
  }, [sortMode]);

  // System-Theme folgt live (Auto-Theme), solange der Nutzer nicht manuell umschaltet.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('bdm-theme')) setTheme(e.matches ? 'light' : 'dark');
    };
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  // Statistik-Karte „Ohne Kategorie" springt in die passende Sammlung.
  useEffect(() => {
    const on = () => {
      setTab('bookmarks');
      setSelection({ type: 'smart', key: 'uncategorized' });
    };
    window.addEventListener('bdm-select-uncategorized', on);
    return () => window.removeEventListener('bdm-select-uncategorized', on);
  }, []);

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
          case 'recent':
            if (!bm.lastOpenedAt) return false;
            break;
          case 'hunt':
            if (bm.source !== 'copyNpaste' || (bm.capturedAt ?? 0) < dayStart.getTime()) return false;
            break;
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
    list = sortBookmarks(list, selection.type === 'smart' && selection.key === 'recent' ? 'recent' : sortMode);

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
  }, [api.state, query, selection, sortMode]);

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
  const storageNotice = api.storageError && <div className="storage-error" role="alert">
    {api.storageError} <button className="btn small" onClick={api.retrySave}>Erneut speichern</button>
    <button className="btn small" onClick={() => setShowSettings(true)}>Sicherung / Import</button>
  </div>;
  const toggleChecked = (id: string) => setChecked((old) => {
    const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const selectedIds = [...checked].filter((id) => api.state.bookmarks.some((b) => b.id === id));
  const quickActions = [
    { label: "Today's Hunt", icon: 'sparkles' as const, run: () => { setMinimized(false); setTab('bookmarks'); setSelection({type:'smart',key:'hunt'}); } },
    { label: 'Hinzufügen', icon: 'plus' as const, run: () => setEditing({open:true}) },
    { label: 'Import', icon: 'upload' as const, run: () => { setMinimized(false); setShowImport(true); } },
    { label: 'Glossar', icon: 'book' as const, run: () => { setMinimized(false); setShowGlossary(true); } },
    { label: 'Video-Studio', icon: 'film' as const, run: () => { setMinimized(false); setShowVideo(true); } },
    { label: 'Einstellungen', icon: 'layers' as const, run: () => setShowSettings(true) },
  ];

  // ── Kompaktmodus: schlanke Schnellzugriffs-Leiste ──
  if (minimized) {
    const quickCat = quickOpen ? api.state.categories.find((c) => c.id === quickOpen) : null;
    return (
      <div className="app compact-app" data-theme={theme}>
        <header className="quickbar">
          <QuickMenu actions={quickActions} />
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
        {storageNotice}
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
        {deployId && <ClickerDialog api={api} bookmarkId={deployId} onClose={() => setDeployId(null)} notify={notify} />}
        {showSettings && <SettingsDialog api={api} shortcut={shortcut} onShortcutChange={(c) => { setShortcut(c); storeShortcut(c); }} onClose={() => setShowSettings(false)} notify={notify} />}
        <ToastHost toasts={toasts} />
      </div>
    );
  }

  // ── Vollansicht ──
  return (
    <div className="app" data-theme={theme}>
      <header className="topbar">
        <QuickMenu actions={quickActions} />
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
      {storageNotice}
      {selection.type === 'smart' && selection.key === 'hunt' && <p className="hunt-status" role="status">{huntStatus}</p>}
      <div className="layout">
        <aside className="sidebar">
          <Sidebar selection={selection} onSelect={setSelection} api={api} notify={notify} />
        </aside>
        <main className="main">
          {tab === 'curated' ? (
            <CuratedPanel api={api} />
          ) : tab === 'stats' ? <StatsPanel api={api} notify={notify} /> : (
            <>
            <div className="list-controls">
              <label>Sortierung <select aria-label="Sortierung" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>{SORT_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label>
              <button className="btn small" onClick={() => { setSelectMode(!selectMode); setChecked(new Set()); }}>{selectMode ? 'Auswahl beenden' : 'Mehrere auswählen'}</button>
              <button className="btn small" disabled={!api.canUndo} onClick={api.undo}>Rückgängig</button>
              <button className="btn small" disabled={!api.canRedo} onClick={api.redo}>Wiederholen</button>
            </div>
            {selectMode && <div className="list-controls" aria-label="Mehrfachaktionen">
              <span>{selectedIds.length} ausgewählt</span>
              <button className="btn small" onClick={() => setChecked(new Set(direct.map((b) => b.id)))}>Sichtbare auswählen</button>
              <button className="btn small" disabled={!selectedIds.length} onClick={() => api.setPinned(selectedIds, true)}>Anpinnen</button>
              <button className="btn small" disabled={!selectedIds.length} onClick={() => { const tag = prompt('Tag für die Auswahl'); if (tag) api.addTagToMany(selectedIds, tag); }}>Tag ergänzen</button>
              <select aria-label="Kategorie für Auswahl" value="" disabled={!selectedIds.length} onChange={(e) => api.assignManyToCategory(selectedIds, e.target.value)}><option value="" disabled>Kategorie zuordnen …</option>{api.state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <button className="btn small danger" disabled={!selectedIds.length} onClick={() => { if (confirm(`${selectedIds.length} Lesezeichen löschen? Rückgängig ist anschließend möglich.`)) { api.removeMany(selectedIds); setChecked(new Set()); notify('Auswahl entfernt', 'ok', undefined, { label: 'Rückgängig', run: api.undo }); } }}>Löschen</button>
            </div>}
            <BookmarkList
              checked={selectMode ? checked : undefined}
              onCheck={toggleChecked}
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
            </>
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
        <Suspense fallback={<div role="status">Video-Studio lädt …</div>}><VideoStudio api={api} onClose={() => setShowVideo(false)} notify={notify} /></Suspense>
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
