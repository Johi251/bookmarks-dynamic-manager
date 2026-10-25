/** Datenmodell des Bookmarks Dynamic Manager. */

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  /** epoch ms — Basis für die Sortierung „jüngstes zuerst". */
  added: number;
  tags: string[];
  categoryIds: string[];
  pinned: boolean;
  note?: string;
}

export type CategorySource = 'import' | 'auto' | 'manual' | 'rule' | 'seed';

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  source: CategorySource;
}

export type RuleKind = 'domain' | 'keyword';

export interface CategorizeRule {
  id: string;
  /** Bei `domain`: wird gegen den Hostnamen gematcht (Teilstring). Bei `keyword`: gegen Host + Pfad + Titel. */
  pattern: string;
  kind: RuleKind;
  /** Kategorienamen (Mehrfachzuordnung erlaubt); fehlende Kategorien werden automatisch angelegt. */
  categories: string[];
  enabled: boolean;
}

export interface AppState {
  version: 1;
  bookmarks: Bookmark[];
  categories: Category[];
  rules: CategorizeRule[];
}

/** Auswahl in der Seitenleiste. */
export type Selection =
  | { type: 'all' }
  | { type: 'smart'; key: SmartViewKey }
  | { type: 'category'; categoryId: string };

export type SmartViewKey = 'today' | 'week' | 'github' | 'ki' | 'pinned' | 'uncategorized';

export const SMART_VIEWS: { key: SmartViewKey; label: string; icon: string }[] = [
  { key: 'today', label: 'Neu heute', icon: '✨' },
  { key: 'week', label: 'Neu (7 Tage)', icon: '🕒' },
  { key: 'github', label: 'GitHub', icon: '🐙' },
  { key: 'ki', label: 'KI-Tools', icon: '🤖' },
  { key: 'pinned', label: 'Angepinnt', icon: '📌' },
  { key: 'uncategorized', label: 'Ohne Kategorie', icon: '❓' },
];
