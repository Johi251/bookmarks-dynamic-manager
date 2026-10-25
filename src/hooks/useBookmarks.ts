import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { AppState, Bookmark, Category, CategorizeRule } from '../types';
import { categorize } from '../categorizer';
import { clearState, loadStateAsync, saveStateSync, subscribeChanges } from '../storage';
import { createDemoBookmarks } from '../demo';
import { createSeedState, uid } from '../rules';
import { addBookmarkToState, mapNamesToIds, type NewBookmarkInput } from '../applyBookmark';
import type { ParsedImport } from '../parser/netscape';

export interface BookmarksApi {
  state: AppState;
  addBookmark: (input: Omit<NewBookmarkInput, 'folderPath' | 'added' | 'id'>) => void;
  updateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id'>>) => void;
  removeBookmark: (id: string) => void;
  togglePin: (id: string) => void;
  importNetscape: (parsed: ParsedImport) => void;
  importState: (imported: AppState, mode: 'merge' | 'replace') => void;
  addCategory: (name: string, parentId?: string | null) => Category;
  setRules: (rules: CategorizeRule[]) => void;
  recategorizeAll: () => void;
  loadDemo: () => void;
  resetAll: () => void;
  suggestCategories: (url: string, title: string) => string[];
}

type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'add'; input: NewBookmarkInput }
  | { type: 'update'; id: string; patch: Partial<Omit<Bookmark, 'id'>> }
  | { type: 'remove'; id: string }
  | { type: 'pin'; id: string }
  | { type: 'importNet'; parsed: ParsedImport }
  | { type: 'importState'; imported: AppState; mode: 'merge' | 'replace' }
  | { type: 'addCategory'; name: string; parentId?: string | null }
  | { type: 'setRules'; rules: CategorizeRule[] }
  | { type: 'recategorize' }
  | { type: 'demo' }
  | { type: 'reset' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'add': {
      const res = addBookmarkToState(state, action.input);
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
      const { parsed } = action;
      let s: AppState = { ...state, categories: [...state.categories, ...parsed.categories] };
      const existingUrls = new Set(state.bookmarks.map((b) => b.url.toLowerCase().replace(/\/$/, '')));
      const fresh = parsed.bookmarks.filter((b) => {
        const key = b.url.toLowerCase().replace(/\/$/, '');
        if (existingUrls.has(key)) return false;
        existingUrls.add(key);
        return true;
      });

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
      for (const b of demo) {
        if (existingUrls.has(b.url.toLowerCase())) continue;
        const res = addBookmarkToState(s, { ...b, folderPath: [] });
        if (res) s = res.state;
      }
      return s;
    }
    case 'reset':
      return createSeedState();
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
      addBookmark: (input) => dispatch({ type: 'add', input }),
      updateBookmark: (id, patch) => dispatch({ type: 'update', id, patch }),
      removeBookmark: (id) => dispatch({ type: 'remove', id }),
      togglePin: (id) => dispatch({ type: 'pin', id }),
      importNetscape: (parsed) => dispatch({ type: 'importNet', parsed }),
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
