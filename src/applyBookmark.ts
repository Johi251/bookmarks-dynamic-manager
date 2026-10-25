import type { AppState, Bookmark, Category } from './types';
import { categorize } from './categorizer';
import { uid } from './rules';

/**
 * Gemeinsame Kern-Logik „Lesezeichen in Zustand einfügen" — genutzt von der App
 * (Web/Desktop) und vom Add-on-Background. Auto-Kategorisierung und manuelle
 * Auswahl werden zusammengeführt (Multi-Kategorie).
 */

/** Legt eine Kategorie nach Namen an, falls sie fehlt (case-insensitive). */
export function ensureCategory(state: AppState, name: string, source: Category['source'] = 'auto'): AppState {
  const exists = state.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (exists) return state;
  return { ...state, categories: [...state.categories, { id: uid('cat'), name, parentId: null, source }] };
}

/** Ordnet Kategorienamen zu IDs zu (legt fehlende an) und dedupliziert. */
export function mapNamesToIds(names: string[], state: AppState): { state: AppState; ids: string[] } {
  let s = state;
  const ids: string[] = [];
  for (const name of names) {
    s = ensureCategory(s, name);
    const cat = s.categories.find((c) => c.name.toLowerCase() === name.toLowerCase())!;
    if (!ids.includes(cat.id)) ids.push(cat.id);
  }
  return { state: s, ids };
}

export interface NewBookmarkInput {
  title: string;
  url: string;
  tags: string[];
  categoryIds: string[];
  pinned: boolean;
  note?: string;
  /** Import-Herkunft (Ordnerpfad) als zusätzliches Kategorisierungs-Signal. */
  folderPath?: string[];
  /** Vorgegebenes Datum (z. B. ADD_DATE aus einem Browser-Import). */
  added?: number;
  id?: string;
}

/** Fügt ein Lesezeichen hinzu; bereits vorhandene URL → null (Duplikat). */
export function addBookmarkToState(state: AppState, input: NewBookmarkInput): { state: AppState; bookmark: Bookmark } | null {
  const url = input.url.startsWith('http') ? input.url : `https://${input.url}`;
  const dup = state.bookmarks.find((b) => b.url.toLowerCase().replace(/\/$/, '') === url.toLowerCase().replace(/\/$/, ''));
  if (dup) return null;

  const auto = categorize(url, input.title, input.folderPath ?? [], state.rules);
  const { state: s1, ids: autoIds } = mapNamesToIds(auto.categories, state);
  const categoryIds = [...new Set([...input.categoryIds, ...autoIds])];

  const bookmark: Bookmark = {
    id: input.id ?? uid('bm'),
    title: input.title.trim() || url,
    url,
    added: input.added ?? Date.now(),
    tags: input.tags,
    categoryIds,
    pinned: input.pinned,
    note: input.note,
  };
  return { state: { ...s1, bookmarks: [bookmark, ...s1.bookmarks] }, bookmark };
}
