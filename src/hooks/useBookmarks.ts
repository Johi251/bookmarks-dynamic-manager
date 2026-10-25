import { useEffect, useMemo, useReducer } from 'react';
import type { AppState, Bookmark, Category, CategorizeRule } from '../types';
import { categorize } from '../categorizer';
import { clearState, loadState, saveState } from '../storage';
import { createDemoBookmarks } from '../demo';
import { DEFAULT_RULES, uid } from '../rules';
import type { ParsedImport } from '../parser/netscape';

export interface BookmarksApi {
  state: AppState;
  addBookmark: (input: { title: string; url: string; tags: string[]; categoryIds: string[]; pinned: boolean; note?: string }) => void;
  updateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id'>>) => void;
  removeBookmark: (id: string) => void;
  togglePin: (id: string) => void;
  importNetscape: (parsed: ParsedImport) => { added: number; skipped: number };
  importState: (imported: AppState, mode: 'merge' | 'replace') => void;
  addCategory: (name: string, parentId?: string | null) => Category;
  setRules: (rules: CategorizeRule[]) => void;
  recategorizeAll: () => void;
  loadDemo: () => void;
  resetAll: () => void;
  suggestCategories: (url: string, title: string) => string[];
}

type Action =
  | { type: 'add'; input: BookmarksApi['addBookmark'] extends (i: infer I) => void ? I : never }
  | { type: 'update'; id: string; patch: Partial<Omit<Bookmark, 'id'>> }
  | { type: 'remove'; id: string }
  | { type: 'pin'; id: string }
  | { type: 'importNet'; parsed: ParsedImport; addedRef: { value: number } }
  | { type: 'importState'; imported: AppState; mode: 'merge' | 'replace' }
  | { type: 'addCategory'; name: string; parentId?: string | null }
  | { type: 'setRules'; rules: CategorizeRule[] }
  | { type: 'recategorize' }
  | { type: 'demo' }
  | { type: 'reset' };

/** Legt eine Kategorie nach Namen an, falls sie (auf beliebiger Ebene) fehlt. */
function ensureCategory(state: AppState, name: string, parentId: string | null, source: Category['source']): AppState {
  const exists = state.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (exists) return state;
  const cat: Category = { id: uid('cat'), name, parentId, source };
  return { ...state, categories: [...state.categories, cat] };
}

/** Ordnet Kategorienamen zu IDs zu (legt fehlende Kategorien an) und dedupliziert. */
function mapNamesToIds(names: string[], state: AppState): { state: AppState; ids: string[] } {
  let s = state;
  const ids: string[] = [];
  for (const name of names) {
    s = ensureCategory(s, name, null, 'auto');
    const cat = s.categories.find((c) => c.name.toLowerCase() === name.toLowerCase())!;
    if (!ids.includes(cat.id)) ids.push(cat.id);
  }
  return { state: s, ids };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'add': {
      const { title, url, tags, categoryIds, pinned, note } = action.input;
      const folderCats: string[] = [];
      // Auto-Kategorisierung + manuelle Auswahl zusammenführen.
      const auto = categorize(url, title, folderCats, state.rules);
      const { state: s1, ids: autoIds } = mapNamesToIds(auto.categories, state);
      const merged = [...new Set([...categoryIds, ...autoIds])];
      const bm: Bookmark = {
        id: uid('bm'),
        title: title.trim() || url,
        url: url.startsWith('http') ? url : `https://${url}`,
        added: Date.now(),
        tags,
        categoryIds: merged,
        pinned,
        note,
      };
      return { ...s1, bookmarks: [bm, ...s1.bookmarks] };
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
      const { parsed } = action;
      let s: AppState = { ...state, categories: [...state.categories, ...parsed.categories] };
      const existingUrls = new Set(state.bookmarks.map((b) => b.url.toLowerCase().replace(/\/$/, '')));
      const fresh = parsed.bookmarks.filter((b) => {
        const key = b.url.toLowerCase().replace(/\/$/, '');
        if (existingUrls.has(key)) return false;
        existingUrls.add(key);
        return true;
      });
      action.addedRef.value = fresh.length;

      // Auto-Kategorisierung auf alle importierten Links anwenden (Multi-Kategorie!).
      const withCats: Bookmark[] = fresh.map((b) => {
        const importCatIds = b.categoryIds; // Ordnerherkunft aus dem Export
        const importNames = importCatIds
          .map((id) => parsed.categories.find((c) => c.id === id)?.name)
          .filter((n): n is string => Boolean(n));
        const auto = categorize(b.url, b.title, importNames, state.rules);
        const { state: s2, ids } = mapNamesToIds(auto.categories, s);
        s = s2;
        return { ...b, categoryIds: [...new Set([...importCatIds, ...ids])] };
      });
      return { ...s, bookmarks: [...withCats, ...state.bookmarks] };
    }
    case 'importState': {
      const { imported, mode } = action;
      if (mode === 'replace') return { ...imported };
      // Merge: Kategorien nach Name deduplizieren, Links nach URL.
      let s: AppState = { ...state };
      const catMap = new Map<string, string>();
      for (const cat of imported.categories) {
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
      const fresh = imported.bookmarks
        .filter((b) => {
          const key = b.url.toLowerCase().replace(/\/$/, '');
          if (existingUrls.has(key)) return false;
          existingUrls.add(key);
          return true;
        })
        .map((b) => ({ ...b, id: uid('bm'), categoryIds: b.categoryIds.map((id) => catMap.get(id) ?? id).filter(Boolean) }));
      const rules = [...s.rules];
      for (const r of imported.rules) {
        if (!rules.some((x) => x.id === r.id)) rules.push(r);
      }
      return { ...s, bookmarks: [...fresh, ...s.bookmarks], rules };
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
      const withCats = demo
        .filter((b) => !existingUrls.has(b.url.toLowerCase()))
        .map((b) => {
          const auto = categorize(b.url, b.title, [], s.rules);
          const { state: s2, ids } = mapNamesToIds(auto.categories, s);
          s = s2;
          return { ...b, categoryIds: ids };
        });
      return { ...s, bookmarks: [...withCats, ...s.bookmarks] };
    }
    case 'reset':
      return { version: 1, bookmarks: [], categories: [], rules: DEFAULT_RULES };
    default:
      return state;
  }
}

export function useBookmarks(): BookmarksApi {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  return useMemo<BookmarksApi>(
    () => ({
      state,
      addBookmark: (input) => dispatch({ type: 'add', input }),
      updateBookmark: (id, patch) => dispatch({ type: 'update', id, patch }),
      removeBookmark: (id) => dispatch({ type: 'remove', id }),
      togglePin: (id) => dispatch({ type: 'pin', id }),
      importNetscape: (parsed) => {
        const addedRef = { value: 0 };
        dispatch({ type: 'importNet', parsed, addedRef });
        return { added: parsed.bookmarks.length, skipped: parsed.skippedDuplicates };
      },
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
    }),
    [state]
  );
}
