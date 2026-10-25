import type { AppState, Bookmark, Category } from './types';
import { categorize } from './categorizer';
import { uid } from './rules';
import { analyzeBookmark } from './ai/engine';
import { classifyClicker } from './oneclicker';

/**
 * Gemeinsame Kern-Logik „Lesezeichen in Zustand einfügen" — genutzt von der App
 * (Web/Desktop) und vom Add-on-Background. Auto-Kategorisierung und manuelle
 * Auswahl werden zusammengeführt (Multi-Kategorie); optional reichert die
 * lokale KI-Engine Meta-Tags und Glossar-Kategorien an.
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

export interface AddOptions {
  /** KI-Anreicherung: Meta-Tags + Glossar-Kategorien lokal berechnen und mergen. */
  enrich?: boolean;
}

/** Fügt ein Lesezeichen hinzu; bereits vorhandene URL → null (Duplikat). */
export function addBookmarkToState(
  state: AppState,
  input: NewBookmarkInput,
  opts: AddOptions = {}
): { state: AppState; bookmark: Bookmark } | null {
  const url = input.url.startsWith('http') ? input.url : `https://${input.url}`;
  const dup = state.bookmarks.find((b) => b.url.toLowerCase().replace(/\/$/, '') === url.toLowerCase().replace(/\/$/, ''));
  if (dup) return null;

  const auto = categorize(url, input.title, input.folderPath ?? [], state.rules);
  let extraCategories: string[] = [];
  let extraTags: string[] = [];
  if (opts.enrich) {
    const analysis = analyzeBookmark(url, input.title, input.tags, state.glossary);
    extraTags = analysis.tags;
    extraCategories = analysis.categories;
  }

  const wantedCats = [...auto.categories, ...extraCategories.filter((c) => !auto.categories.includes(c))];
  const { state: s1, ids: autoIds } = mapNamesToIds(wantedCats, state);
  const categoryIds = [...new Set([...input.categoryIds, ...autoIds])];

  // 1Clicker: Nutzungsweg-Klassifikation direkt beim Anlegen (Repository → 🟠 Checking …).
  const clicker = classifyClicker(url, input.title, input.tags);

  const bookmark: Bookmark = {
    id: input.id ?? uid('bm'),
    title: input.title.trim() || url,
    url,
    added: input.added ?? Date.now(),
    tags: [...new Set([...input.tags, ...extraTags])],
    categoryIds,
    pinned: input.pinned,
    note: input.note,
    clicker,
  };
  return { state: { ...s1, bookmarks: [bookmark, ...s1.bookmarks] }, bookmark };
}
