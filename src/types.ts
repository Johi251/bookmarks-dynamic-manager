/** Datenmodell des Bookmarks Dynamic Manager. */

export const APP_VERSION = '1.2.0';

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

/** Glossar-Eintrag: eigene Begriffskette (z. B. „JayTX → Musiker Business, SMMA, Lyric Videos"). */
export interface GlossaryEntry {
  id: string;
  /** Der Begriff selbst (z. B. „SMMA", „JayTX", „ROFLnator.90"). */
  term: string;
  /** Kurze Erklärung (z. B. „Social Media Marketing"). */
  definition: string;
  /** Verwandte Begriffe/Themen — Basis für Tags und Cross-Verlinkung. */
  related: string[];
  createdAt: number;
}

/**
 * Dynamische Gruppe („Hashtag-Manager"): sammelt autonom alle Lesezeichen,
 * auf die eines der Match-Terms passt. Ein Term mit führendem „#" matcht
 * ausschließlich Tags; ohne „#" den Text aus Titel, URL, Tags, Kategorien.
 */
export interface DynamicGroup {
  id: string;
  /** Anzeigename, z. B. „#TOP KI". */
  name: string;
  terms: string[];
  createdAt: number;
}

export interface AppSettings {
  /** Kategorie-IDs der Favoriten für die Schnellzugriffs-Leiste (Kompaktmodus). */
  favorites: string[];
  /** App im schlanken Kompaktmodus starten. */
  startMinimized: boolean;
  /** KI-Strukturierung beim Import: lokale Engine oder eigene API (OpenAI-kompatibel). */
  aiProvider: 'local' | 'api';
  aiEndpoint: string;
  aiModel: string;
}

export interface AppState {
  version: 2;
  bookmarks: Bookmark[];
  categories: Category[];
  rules: CategorizeRule[];
  glossary: GlossaryEntry[];
  dynamicGroups: DynamicGroup[];
  settings: AppSettings;
}

/** Auswahl in der Seitenleiste. */
export type Selection =
  | { type: 'all' }
  | { type: 'smart'; key: SmartViewKey }
  | { type: 'category'; categoryId: string }
  | { type: 'tag'; tag: string }
  | { type: 'group'; groupId: string };

export type SmartViewKey = 'today' | 'week' | 'github' | 'ki' | 'pinned' | 'uncategorized';

export const SMART_VIEWS: { key: SmartViewKey; label: string; icon: string }[] = [
  { key: 'today', label: 'Neu heute', icon: 'sparkles' },
  { key: 'week', label: 'Neu (7 Tage)', icon: 'clock' },
  { key: 'github', label: 'GitHub', icon: 'github' },
  { key: 'ki', label: 'KI-Tools', icon: 'bot' },
  { key: 'pinned', label: 'Angepinnt', icon: 'pin' },
  { key: 'uncategorized', label: 'Ohne Kategorie', icon: 'help' },
];
