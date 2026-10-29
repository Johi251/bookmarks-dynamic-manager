import { urlKey } from '../host';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { AppSettings, AppState, Bookmark, Category, CategorizeRule, GlossaryEntry } from '../types';
import { categorize } from '../categorizer';
import { loadStateAsync, migrateState, saveState, subscribeChanges } from '../storage';
import { createDemoBookmarks } from '../demo';
import { createSeedState, uid } from '../rules';
import { addBookmarkToState, mapNamesToIds, type NewBookmarkInput } from '../applyBookmark';
import { analyzeBookmark, type SmartAnalysis } from '../ai/engine';
import { matchGlossary } from '../glossary';
import { classifyClicker } from '../oneclicker';
import type { ParsedImport } from '../parser/netscape';
import type { HuntItem } from '../integrations';

export interface ImportEnrichment {
  /** KI-Strukturierung anwenden (Meta-Tags + Glossar-Kategorien). */
  smart: boolean;
  /** Vorberechnete API-Analysen (Schlüssel: normalisierte URL) — fällt der
      Reducer darauf zurück, sonst rechnet er lokal. */
  analyses?: Map<string, SmartAnalysis>;
}

export interface BookmarksApi {
  state: AppState;
  /** true, sobald der persistierte Zustand geladen wurde (Kompaktstart etc.). */
  ready: boolean;
  storageError: string | null;
  retrySave: () => void;
  acceptHunt: (items: HuntItem[]) => Promise<void>;
  /** globale Rückgängig-/Wiederholen-Historie (Strg+Z / Strg+Shift+Z). */
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  addBookmark: (input: Omit<NewBookmarkInput, 'folderPath' | 'added' | 'id'>) => void;
  updateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id'>>) => void;
  removeBookmark: (id: string) => void;
  removeMany: (ids: string[]) => void;
  mergeDuplicates: (groups: string[][]) => void;
  togglePin: (id: string) => void;
  setPinned: (ids: string[], pinned: boolean) => void;
  /** Öffnungs-Statistik (Zähler + Zeitstempel) — bewusst NICHT rückgängig machbar. */
  markOpened: (id: string) => void;
  importNetscape: (parsed: ParsedImport, enrich?: ImportEnrichment) => void;
  importState: (imported: AppState, mode: 'merge' | 'replace') => void;
  addCategory: (name: string, parentId?: string | null) => Category;
  setRules: (rules: CategorizeRule[]) => void;
  recategorizeAll: () => void;
  loadDemo: () => void;
  resetAll: () => void;
  suggestCategories: (url: string, title: string) => string[];
  suggestTags: (url: string, title: string) => string[];
  // Glossar
  upsertGlossaryEntry: (entry: Omit<GlossaryEntry, 'id' | 'createdAt'> & { id?: string }) => GlossaryEntry;
  removeGlossaryEntry: (id: string) => void;
  applyGlossary: () => number;
  // Dynamische Gruppen
  addDynamicGroup: (name: string, terms: string[]) => void;
  removeDynamicGroup: (id: string) => void;
  // Zuordnungen & Tags
  assignToCategory: (bookmarkId: string, categoryId: string) => void;
  assignManyToCategory: (ids: string[], categoryId: string) => void;
  unassignFromCategory: (bookmarkId: string, categoryId: string) => void;
  addTag: (bookmarkId: string, tag: string) => void;
  addTagToMany: (ids: string[], tag: string) => void;
  removeTag: (bookmarkId: string, tag: string) => void;
  // Einstellungen
  updateSettings: (patch: Partial<AppSettings>) => void;
  toggleFavorite: (categoryId: string) => void;
}

type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'add'; input: NewBookmarkInput }
  | { type: 'update'; id: string; patch: Partial<Omit<Bookmark, 'id'>> }
  | { type: 'remove'; id: string }
  | { type: 'removeMany'; ids: string[] }
  | { type: 'mergeDuplicates'; groups: string[][] }
  | { type: 'markOpened'; id: string }
  | { type: 'pin'; id: string }
  | { type: 'pinMany'; ids: string[]; pinned: boolean }
  | { type: 'importNet'; parsed: ParsedImport; enrich?: ImportEnrichment }
  | { type: 'importState'; imported: AppState; mode: 'merge' | 'replace' }
  | { type: 'addCategory'; category: Category }
  | { type: 'setRules'; rules: CategorizeRule[] }
  | { type: 'recategorize' }
  | { type: 'demo' }
  | { type: 'reset' }
  | { type: 'glossaryUpsert'; entry: Omit<GlossaryEntry, 'id' | 'createdAt'> & { id?: string } }
  | { type: 'glossaryRemove'; id: string }
  | { type: 'glossaryApply' }
  | { type: 'groupAdd'; name: string; terms: string[] }
  | { type: 'groupRemove'; id: string }
  | { type: 'assign'; bookmarkId: string; categoryId: string }
  | { type: 'assignMany'; ids: string[]; categoryId: string }
  | { type: 'unassign'; bookmarkId: string; categoryId: string }
  | { type: 'tagAdd'; bookmarkId: string; tag: string }
  | { type: 'tagAddMany'; ids: string[]; tag: string }
  | { type: 'tagRemove'; bookmarkId: string; tag: string }
  | { type: 'settings'; patch: Partial<AppSettings> };

/** Wendet Glossar-Treffer als Tags + Glossar-Hauptgruppe (Kategorie) an. */
function applyGlossaryToBookmark(bm: Bookmark, state: AppState): { bookmark: Bookmark; state: AppState; changed: boolean } {
  const hits = matchGlossary(`${bm.title} ${bm.url} ${bm.tags.join(' ')}`, state.glossary);
  if (hits.length === 0) return { bookmark: bm, state, changed: false };
  const newTags = [...bm.tags];
  for (const { entry } of hits) {
    const add = (t: string) => {
      const n = t.toLowerCase().trim().replace(/\s+/g, '-');
      if (n && !newTags.includes(n)) newTags.push(n);
    };
    add(entry.term);
    entry.related.forEach(add);
  }
  // Hauptgruppe des Begriffs als Kategorie (wird bei Bedarf angelegt).
  const { state: s2, ids } = mapNamesToIds(hits.map((h) => h.entry.term), state);
  return { bookmark: { ...bm, tags: newTags, categoryIds: [...new Set([...bm.categoryIds, ...ids])] }, state: s2, changed: newTags.length !== bm.tags.length || ids.some((id) => !bm.categoryIds.includes(id)) };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'add': {
      const res = addBookmarkToState(state, action.input, { enrich: true });
      return res ? res.state : state;
    }
    case 'update': {
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b)),
      };
    }
    case 'remove':
      return { ...state, bookmarks: state.bookmarks.filter((b) => b.id !== action.id) };
    case 'removeMany': {
      const ids = new Set(action.ids);
      return { ...state, bookmarks: state.bookmarks.filter((b) => !ids.has(b.id)) };
    }
    case 'mergeDuplicates': {
      let bookmarks = state.bookmarks;
      for (const ids of action.groups) {
        const members = ids.map((id) => bookmarks.find((b) => b.id === id)).filter((b): b is Bookmark => !!b);
        if (members.length < 2 || members.some((b) => b.url !== members[0].url && new URL(b.url).href.replace(/\/$/, '') !== new URL(members[0].url).href.replace(/\/$/, ''))) continue;
        const keep = { ...members[0], tags: [...new Set(members.flatMap((b) => b.tags))], categoryIds: [...new Set(members.flatMap((b) => b.categoryIds))],
          note: [...new Set(members.map((b) => b.note).filter(Boolean))].join('\n\n') || undefined,
          pinned: members.some((b) => b.pinned), openedCount: members.reduce((n, b) => n + (b.openedCount ?? 0), 0),
          lastOpenedAt: Math.max(...members.map((b) => b.lastOpenedAt ?? 0)) || undefined };
        bookmarks = bookmarks.filter((b) => !ids.includes(b.id) || b.id === keep.id).map((b) => b.id === keep.id ? keep : b);
      }
      return { ...state, bookmarks };
    }
    case 'markOpened':
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) =>
          b.id === action.id ? { ...b, openedCount: (b.openedCount ?? 0) + 1, lastOpenedAt: Date.now() } : b
        ),
      };
    case 'pin':
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) => (b.id === action.id ? { ...b, pinned: !b.pinned } : b)),
      };
    case 'pinMany': {
      const ids = new Set(action.ids);
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) => (ids.has(b.id) ? { ...b, pinned: action.pinned } : b)),
      };
    }
    case 'importNet': {
      const { parsed, enrich } = action;
      let s: AppState = { ...state, categories: [...state.categories, ...parsed.categories] };
      const existingUrls = new Set(state.bookmarks.map((b) => urlKey(b.url)));
      const fresh = parsed.bookmarks.filter((b) => {
        const key = urlKey(b.url);
        if (existingUrls.has(key)) return false;
        existingUrls.add(key);
        return true;
      });

      // Auto-Kategorisierung auf alle importierten Links anwenden (Multi-Kategorie!),
      // optional mit KI-Strukturierung: vorbereitete API-Analysen oder lokale Engine.
      const withCats: Bookmark[] = fresh.map((b) => {
        const importCatIds = b.categoryIds; // Ordnerherkunft aus dem Export
        const importNames = importCatIds
          .map((id) => parsed.categories.find((c) => c.id === id)?.name)
          .filter((n): n is string => Boolean(n));
        const auto = categorize(b.url, b.title, importNames, state.rules);
        let names = auto.categories;
        let tags = b.tags;
        if (enrich?.smart) {
          const ai =
            enrich.analyses?.get(urlKey(b.url)) ??
            analyzeBookmark(b.url, b.title, b.tags, state.glossary);
          tags = [...new Set([...b.tags, ...ai.tags])];
          names = [...new Set([...names, ...ai.categories])];
        }
        const { state: s2, ids } = mapNamesToIds(names, s);
        s = s2;
        // 1Clicker-Nutzungsweg beim Import gleich miterkennen (Repository → 🟠 Checking …).
        return { ...b, tags, categoryIds: [...new Set([...importCatIds, ...ids])], clicker: classifyClicker(b.url, b.title, tags) };
      });
      return { ...s, bookmarks: [...withCats, ...state.bookmarks] };
    }
    case 'importState': {
      const { imported, mode } = action;
      // Alte Exporte (v1/v2) via Migration auf v3 heben — inkl. statischer
      // 1Clicker-Klassifikation und neuer Settings-Defaults.
      const normalized = migrateState(imported);
      if (!normalized) return state;
      if (mode === 'replace') return normalized;
      // Merge: Kategorien nach Name deduplizieren, Links nach URL.
      let s: AppState = { ...state };
      const catMap = new Map<string, string>();
      const addCategory = (cat: Category): string => {
        const known = catMap.get(cat.id);
        if (known) return known;
        const parent = cat.parentId ? normalized.categories.find((c) => c.id === cat.parentId) : undefined;
        const parentId = parent ? addCategory(parent) : null;
        const existing = s.categories.find((c) => c.parentId === parentId && c.name.toLowerCase() === cat.name.toLowerCase());
        const id = existing?.id ?? uid('cat');
        catMap.set(cat.id, id);
        if (!existing) s = { ...s, categories: [...s.categories, { ...cat, id, parentId }] };
        return id;
      };
      normalized.categories.forEach(addCategory);
      const existingUrls = new Set(s.bookmarks.map((b) => urlKey(b.url)));
      const fresh = normalized.bookmarks
        .filter((b) => {
          const key = urlKey(b.url);
          if (existingUrls.has(key)) return false;
          existingUrls.add(key);
          return true;
        })
        .map((b) => ({ ...b, id: uid('bm'), categoryIds: b.categoryIds.map((id) => catMap.get(id) ?? id).filter(Boolean) }));
      const rules = [...s.rules];
      for (const r of normalized.rules) {
        if (!rules.some((x) => x.id === r.id)) rules.push(r);
      }
      const glossary = [...s.glossary];
      for (const g of normalized.glossary ?? []) {
        if (!glossary.some((x) => x.term.toLowerCase() === g.term.toLowerCase())) glossary.push(g);
      }
      const dynamicGroups = [...s.dynamicGroups];
      for (const g of normalized.dynamicGroups ?? []) {
        if (!dynamicGroups.some((x) => x.name.toLowerCase() === g.name.toLowerCase())) dynamicGroups.push(g);
      }
      return { ...s, bookmarks: [...fresh, ...s.bookmarks], rules, glossary, dynamicGroups };
    }
    case 'addCategory': {
      const cat = action.category;
      if (state.categories.some((c) => c.id === cat.id || (c.parentId === cat.parentId && c.name.toLowerCase() === cat.name.toLowerCase()))) return state;
      return { ...state, categories: [...state.categories, cat] };
    }
    case 'setRules':
      return { ...state, rules: action.rules };
    case 'recategorize': {
      let s: AppState = { ...state };
      const bookmarks = state.bookmarks.map((b) => {
        const importNames = b.categoryIds
          .map((id) => s.categories.find((c) => c.id === id)?.name)
          .filter((n): n is string => Boolean(n));
        const auto = categorize(b.url, b.title, importNames, state.rules);
        const { state: s2, ids } = mapNamesToIds(auto.categories, s);
        s = s2;
        return { ...b, categoryIds: ids };
      });
      return { ...s, bookmarks };
    }
    case 'demo': {
      const demo = createDemoBookmarks();
      let s: AppState = { ...state };
      const existingUrls = new Set(s.bookmarks.map((b) => urlKey(b.url)));
      for (const b of demo) {
        if (existingUrls.has(urlKey(b.url))) continue;
        const res = addBookmarkToState(s, { ...b, folderPath: [] }, { enrich: true });
        if (res) s = res.state;
      }
      return s;
    }
    case 'reset':
      return createSeedState();
    case 'glossaryUpsert': {
      const { entry } = action;
      const existing = entry.id ? state.glossary.find((g) => g.id === entry.id) : undefined;
      const normalized: GlossaryEntry = {
        id: existing?.id ?? uid('gloss'),
        term: entry.term.trim(),
        definition: entry.definition.trim(),
        related: entry.related.map((r) => r.trim()).filter(Boolean),
        createdAt: existing?.createdAt ?? Date.now(),
      };
      const glossary = existing
        ? state.glossary.map((g) => (g.id === existing.id ? normalized : g))
        : [...state.glossary, normalized];
      // Direkt anwenden: bestehende Treffer bekommen die neuen Tags/Kategorien.
      let s: AppState = { ...state, glossary };
      const bookmarks = s.bookmarks.map((b) => {
        const res = applyGlossaryToBookmark(b, s);
        s = res.state;
        return res.bookmark;
      });
      return { ...s, bookmarks };
    }
    case 'glossaryRemove':
      return { ...state, glossary: state.glossary.filter((g) => g.id !== action.id) };
    case 'glossaryApply': {
      let s: AppState = { ...state };
      const bookmarks = s.bookmarks.map((b) => {
        const res = applyGlossaryToBookmark(b, s);
        s = res.state;
        return res.bookmark;
      });
      return { ...s, bookmarks };
    }
    case 'groupAdd': {
      if (!action.name.trim()) return state;
      const dup = state.dynamicGroups.find((g) => g.name.toLowerCase() === action.name.trim().toLowerCase());
      if (dup) return state;
      return {
        ...state,
        dynamicGroups: [
          ...state.dynamicGroups,
          { id: uid('grp'), name: action.name.trim(), terms: action.terms, createdAt: Date.now() },
        ],
      };
    }
    case 'groupRemove':
      return { ...state, dynamicGroups: state.dynamicGroups.filter((g) => g.id !== action.id) };
    case 'assign':
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) =>
          b.id === action.bookmarkId && !b.categoryIds.includes(action.categoryId)
            ? { ...b, categoryIds: [...b.categoryIds, action.categoryId] }
            : b
        ),
      };
    case 'assignMany': {
      const ids = new Set(action.ids);
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) =>
          ids.has(b.id) && !b.categoryIds.includes(action.categoryId)
            ? { ...b, categoryIds: [...b.categoryIds, action.categoryId] }
            : b
        ),
      };
    }
    case 'unassign':
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) =>
          b.id === action.bookmarkId ? { ...b, categoryIds: b.categoryIds.filter((id) => id !== action.categoryId) } : b
        ),
      };
    case 'tagAdd': {
      const tag = action.tag.toLowerCase().trim();
      if (!tag) return state;
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) => (b.id === action.bookmarkId && !b.tags.includes(tag) ? { ...b, tags: [...b.tags, tag] } : b)),
      };
    }
    case 'tagAddMany': {
      const tag = action.tag.toLowerCase().trim().replace(/\s+/g, '-');
      if (!tag) return state;
      const ids = new Set(action.ids);
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) => (ids.has(b.id) && !b.tags.includes(tag) ? { ...b, tags: [...b.tags, tag] } : b)),
      };
    }
    case 'tagRemove':
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) => (b.id === action.bookmarkId ? { ...b, tags: b.tags.filter((t) => t !== action.tag) } : b)),
      };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    default:
      return state;
  }
}

// ── Undo/Redo-Historie (Strg+Z / Strg+Shift+Z) ──────────────────────────────

/** Maximale Anzahl rückgängig machbarer Schritte. */
export const HISTORY_LIMIT = 50;

export interface HistoryState {
  present: AppState;
  past: AppState[];
  future: AppState[];
}

/**
 * Reiner History-Reduzierer um den App-Reduzierer: jede Zustandsänderung landet
 * auf dem Past-Stapel (max. 50), Undo/Redo verschieben zwischen den Stapeln.
 * No-Op-Ergebnisse (identische Referenz) erzeugen keinen Eintrag.
 */
export function reducerWithHistory(h: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'hydrate':
      return { present: action.state, past: [], future: [] };
    case 'undo': {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      return {
        present: previous,
        past: h.past.slice(0, -1),
        future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
      };
    }
    case 'redo': {
      if (h.future.length === 0) return h;
      const next = h.future[0];
      return {
        present: next,
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        future: h.future.slice(1),
      };
    }
    case 'markOpened': {
      const present = reducer(h.present, action);
      const opened = present.bookmarks.find((b) => b.id === action.id);
      if (!opened) return h;
      const track = (state: AppState): AppState => ({ ...state, bookmarks: state.bookmarks.map((b) => b.id === action.id ? { ...b, openedCount: opened.openedCount, lastOpenedAt: opened.lastOpenedAt } : b) });
      return { present, past: h.past.map(track), future: h.future.map(track) };
    }
    default: {
      const present = reducer(h.present, action);
      if (present === h.present) return h;
      return { present, past: [...h.past, h.present].slice(-HISTORY_LIMIT), future: [] };
    }
  }
}

export function useBookmarks(): BookmarksApi {
  const [history, dispatch] = useReducer(reducerWithHistory, undefined, () => ({
    present: createSeedState(),
    past: [],
    future: [],
  }));
  const state = history.present;
  const currentState = useRef(state);
  currentState.current = state;
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const writes = useRef(Promise.resolve());
  const ownWrites = useRef(new Set<string>());
  const lastSerialized = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadStateAsync().then((loaded) => {
      if (!alive) return;
      const serialized = JSON.stringify(loaded);
      lastSerialized.current = serialized;
      dispatch({ type: 'hydrate', state: loaded });
      setReady(true);
    }).catch((error) => { if (alive) setStorageError(String(error instanceof Error ? error.message : error)); });
    // Externe Änderungen (Add-on-Background, anderer Tab) übernehmen.
    const unsubscribe = subscribeChanges((next) => {
      const serialized = JSON.stringify(next);
      if (!ownWrites.current.has(serialized) && serialized !== lastSerialized.current) {
        lastSerialized.current = serialized;
        dispatch({ type: 'hydrate', state: next });
      }
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastSerialized.current) return; // eigene Rückkopplung ignorieren
    let alive = true;
    ownWrites.current.add(serialized);
    writes.current = writes.current.catch(() => undefined).then(() => saveState(state)).then(() => {
      lastSerialized.current = serialized;
      if (alive) setStorageError(null);
    }).catch((error) => {
      if (alive) setStorageError(`Nicht gespeichert: ${String(error instanceof Error ? error.message : error)}`);
    }).finally(() => { ownWrites.current.delete(serialized); });
    return () => { alive = false; };
  }, [state, ready, saveAttempt]);

  return useMemo<BookmarksApi>(
    () => ({
      state,
      ready,
      storageError,
      retrySave: () => setSaveAttempt((n) => n + 1),
      acceptHunt: async (items) => {
        if (!ready) throw new Error('Zuerst den gespeicherten Bestand laden.');
        await writes.current;
        let next = currentState.current;
        for (const item of items) {
          const result = addBookmarkToState(next, { title: item.title, url: item.url, tags: ['todays-hunt', 'copynpaste'], categoryIds: [], pinned: false }, { enrich: true });
          if (result) next = result.state;
          const capturedAt = Date.parse(item.capturedAt ?? '') || Date.now();
          next = { ...next, bookmarks: next.bookmarks.map((b) => urlKey(b.url) === urlKey(item.url) ? { ...b, source: 'copyNpaste' as const, capturedAt } : b) };
        }
        const serialized = JSON.stringify(next);
        ownWrites.current.add(serialized);
        try {
          await saveState(next);
          lastSerialized.current = serialized;
          dispatch({ type: 'hydrate', state: next });
          setStorageError(null);
        } finally { ownWrites.current.delete(serialized); }
      },
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      addBookmark: (input) => dispatch({ type: 'add', input }),
      updateBookmark: (id, patch) => dispatch({ type: 'update', id, patch }),
      removeBookmark: (id) => dispatch({ type: 'remove', id }),
      removeMany: (ids) => dispatch({ type: 'removeMany', ids }),
      mergeDuplicates: (groups) => dispatch({ type: 'mergeDuplicates', groups }),
      togglePin: (id) => dispatch({ type: 'pin', id }),
      setPinned: (ids, pinned) => dispatch({ type: 'pinMany', ids, pinned }),
      markOpened: (id) => dispatch({ type: 'markOpened', id }),
      importNetscape: (parsed, enrich) => dispatch({ type: 'importNet', parsed, enrich }),
      importState: (imported, mode) => {
        const normalized = migrateState(imported);
        if (!normalized) throw new Error('Ungültige Sicherung: Bestand bleibt unverändert.');
        dispatch({ type: 'importState', imported: normalized, mode });
        setReady(true);
      },
      addCategory: (name, parentId) => {
        const category: Category = state.categories.find((c) => c.name.toLowerCase() === name.trim().toLowerCase() && c.parentId === (parentId ?? null)) ??
          { id: uid('cat'), name: name.trim(), parentId: parentId ?? null, source: 'manual' };
        dispatch({ type: 'addCategory', category });
        return category;
      },
      setRules: (rules) => dispatch({ type: 'setRules', rules }),
      recategorizeAll: () => dispatch({ type: 'recategorize' }),
      loadDemo: () => dispatch({ type: 'demo' }),
      resetAll: () => {
        setReady(true);
        dispatch({ type: 'reset' });
      },
      suggestCategories: (url, title) => categorize(url, title, [], state.rules).categories,
      suggestTags: (url, title) => analyzeBookmark(url, title, [], state.glossary).tags,
      upsertGlossaryEntry: (entry) => {
        dispatch({ type: 'glossaryUpsert', entry });
        const existing = entry.id ? state.glossary.find((g) => g.id === entry.id) : undefined;
        return existing ?? { id: entry.id ?? uid('gloss'), term: entry.term, definition: entry.definition, related: entry.related, createdAt: Date.now() };
      },
      removeGlossaryEntry: (id) => dispatch({ type: 'glossaryRemove', id }),
      applyGlossary: () => {
        // Zähler vorab deterministisch berechnen (wie der Reducer es anwenden wird).
        let count = 0;
        for (const b of state.bookmarks) {
          const hits = matchGlossary(`${b.title} ${b.url} ${b.tags.join(' ')}`, state.glossary);
          if (hits.length === 0) continue;
          const newTags = new Set(b.tags);
          for (const { entry } of hits) {
            newTags.add(entry.term.toLowerCase().trim());
            for (const r of entry.related) newTags.add(r.toLowerCase().trim());
          }
          if (newTags.size !== b.tags.length) count++;
        }
        dispatch({ type: 'glossaryApply' });
        return count;
      },
      addDynamicGroup: (name, terms) => dispatch({ type: 'groupAdd', name, terms }),
      removeDynamicGroup: (id) => dispatch({ type: 'groupRemove', id }),
      assignToCategory: (bookmarkId, categoryId) => dispatch({ type: 'assign', bookmarkId, categoryId }),
      assignManyToCategory: (ids, categoryId) => dispatch({ type: 'assignMany', ids, categoryId }),
      unassignFromCategory: (bookmarkId, categoryId) => dispatch({ type: 'unassign', bookmarkId, categoryId }),
      addTag: (bookmarkId, tag) => dispatch({ type: 'tagAdd', bookmarkId, tag }),
      addTagToMany: (ids, tag) => dispatch({ type: 'tagAddMany', ids, tag }),
      removeTag: (bookmarkId, tag) => dispatch({ type: 'tagRemove', bookmarkId, tag }),
      updateSettings: (patch) => dispatch({ type: 'settings', patch }),
      toggleFavorite: (categoryId) =>
        dispatch({
          type: 'settings',
          patch: {
            favorites: state.settings.favorites.includes(categoryId)
              ? state.settings.favorites.filter((f) => f !== categoryId)
              : [...state.settings.favorites, categoryId],
          },
        }),
    }),
    [state, history.past.length, history.future.length, ready, storageError]
  );
}
