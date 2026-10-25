import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { AppSettings, AppState, Bookmark, Category, CategorizeRule, GlossaryEntry } from '../types';
import { categorize } from '../categorizer';
import { clearState, loadStateAsync, saveStateSync, subscribeChanges } from '../storage';
import { createDemoBookmarks } from '../demo';
import { createSeedState, uid } from '../rules';
import { addBookmarkToState, mapNamesToIds, type NewBookmarkInput } from '../applyBookmark';
import { analyzeBookmark, type SmartAnalysis } from '../ai/engine';
import { matchGlossary } from '../glossary';
import type { ParsedImport } from '../parser/netscape';

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
  addBookmark: (input: Omit<NewBookmarkInput, 'folderPath' | 'added' | 'id'>) => void;
  updateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id'>>) => void;
  removeBookmark: (id: string) => void;
  togglePin: (id: string) => void;
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
  unassignFromCategory: (bookmarkId: string, categoryId: string) => void;
  addTag: (bookmarkId: string, tag: string) => void;
  removeTag: (bookmarkId: string, tag: string) => void;
  // Einstellungen
  updateSettings: (patch: Partial<AppSettings>) => void;
  toggleFavorite: (categoryId: string) => void;
}

type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'add'; input: NewBookmarkInput }
  | { type: 'update'; id: string; patch: Partial<Omit<Bookmark, 'id'>> }
  | { type: 'remove'; id: string }
  | { type: 'pin'; id: string }
  | { type: 'importNet'; parsed: ParsedImport; enrich?: ImportEnrichment }
  | { type: 'importState'; imported: AppState; mode: 'merge' | 'replace' }
  | { type: 'addCategory'; name: string; parentId?: string | null }
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
  | { type: 'unassign'; bookmarkId: string; categoryId: string }
  | { type: 'tagAdd'; bookmarkId: string; tag: string }
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

function reducer(state: AppState, action: Action): AppState {
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
    case 'pin':
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) => (b.id === action.id ? { ...b, pinned: !b.pinned } : b)),
      };
    case 'importNet': {
      const { parsed, enrich } = action;
      let s: AppState = { ...state, categories: [...state.categories, ...parsed.categories] };
      const existingUrls = new Set(state.bookmarks.map((b) => b.url.toLowerCase().replace(/\/$/, '')));
      const fresh = parsed.bookmarks.filter((b) => {
        const key = b.url.toLowerCase().replace(/\/$/, '');
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
            enrich.analyses?.get(b.url.toLowerCase().replace(/\/$/, '')) ??
            analyzeBookmark(b.url, b.title, b.tags, state.glossary);
          tags = [...new Set([...b.tags, ...ai.tags])];
          names = [...new Set([...names, ...ai.categories])];
        }
        const { state: s2, ids } = mapNamesToIds(names, s);
        s = s2;
        return { ...b, tags, categoryIds: [...new Set([...importCatIds, ...ids])] };
      });
      return { ...s, bookmarks: [...withCats, ...state.bookmarks] };
    }
    case 'importState': {
      const { imported, mode } = action;
      // Alte Exporte (v1) auf v2 heben — Glossar/Gruppen fehlen dann (leer).
      const normalized: AppState = imported.version === 2
        ? imported
        : { ...imported, version: 2, glossary: [], dynamicGroups: [], settings: state.settings };
      if (mode === 'replace') return normalized;
      // Merge: Kategorien nach Name deduplizieren, Links nach URL.
      let s: AppState = { ...state };
      const catMap = new Map<string, string>();
      for (const cat of normalized.categories) {
        const existing = s.categories.find((c) => c.name.toLowerCase() === cat.name.toLowerCase());
        if (existing) {
          catMap.set(cat.id, existing.id);
        } else {
          const newCat = { ...cat, id: uid('cat') };
          s = { ...s, categories: [...s.categories, newCat] };
          catMap.set(cat.id, newCat.id);
        }
      }
      const existingUrls = new Set(s.bookmarks.map((b) => b.url.toLowerCase().replace(/\/$/, '')));
      const fresh = normalized.bookmarks
        .filter((b) => {
          const key = b.url.toLowerCase().replace(/\/$/, '');
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
      const parent = action.parentId ?? null;
      const dup = state.categories.find(
        (c) => c.name.toLowerCase() === action.name.toLowerCase() && c.parentId === parent
      );
      if (dup) return state;
      return {
        ...state,
        categories: [...state.categories, { id: uid('cat'), name: action.name.trim(), parentId: parent, source: 'manual' }],
      };
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
      const existingUrls = new Set(s.bookmarks.map((b) => b.url.toLowerCase()));
      for (const b of demo) {
        if (existingUrls.has(b.url.toLowerCase())) continue;
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

export function useBookmarks(): BookmarksApi {
  const [state, dispatch] = useReducer(reducer, undefined, () => createSeedState());
  const [ready, setReady] = useState(false);
  const lastSerialized = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadStateAsync().then((loaded) => {
      if (!alive) return;
      const serialized = JSON.stringify(loaded);
      lastSerialized.current = serialized;
      dispatch({ type: 'hydrate', state: loaded });
      setReady(true);
    });
    // Externe Änderungen (Add-on-Background, anderer Tab) übernehmen.
    const unsubscribe = subscribeChanges((next) => {
      const serialized = JSON.stringify(next);
      if (serialized !== lastSerialized.current) {
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
    lastSerialized.current = serialized;
    saveStateSync(state);
  }, [state, ready]);

  return useMemo<BookmarksApi>(
    () => ({
      state,
      ready,
      addBookmark: (input) => dispatch({ type: 'add', input }),
      updateBookmark: (id, patch) => dispatch({ type: 'update', id, patch }),
      removeBookmark: (id) => dispatch({ type: 'remove', id }),
      togglePin: (id) => dispatch({ type: 'pin', id }),
      importNetscape: (parsed, enrich) => dispatch({ type: 'importNet', parsed, enrich }),
      importState: (imported, mode) => dispatch({ type: 'importState', imported, mode }),
      addCategory: (name, parentId) => {
        dispatch({ type: 'addCategory', name, parentId });
        return state.categories.find((c) => c.name === name) ?? { id: uid('cat'), name, parentId: parentId ?? null, source: 'manual' };
      },
      setRules: (rules) => dispatch({ type: 'setRules', rules }),
      recategorizeAll: () => dispatch({ type: 'recategorize' }),
      loadDemo: () => dispatch({ type: 'demo' }),
      resetAll: () => {
        clearState();
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
      unassignFromCategory: (bookmarkId, categoryId) => dispatch({ type: 'unassign', bookmarkId, categoryId }),
      addTag: (bookmarkId, tag) => dispatch({ type: 'tagAdd', bookmarkId, tag }),
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
    [state]
  );
}
