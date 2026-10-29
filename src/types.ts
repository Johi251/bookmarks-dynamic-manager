/** Datenmodell des Bookmarks Dynamic Manager. */

export const APP_VERSION = '1.4.1';

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
  /** 1Clicker-Status-Engine: Nutzungsweg-Analyse für Software-/Repository-Links. */
  clicker?: ClickerInfo;
  /** Wie oft der Link aus der App geöffnet wurde (Sortierung „Häufig verwendet"). */
  openedCount?: number;
  /** Letzter Öffnen-Zeitpunkt (epoch ms) — Sortierung „Zuletzt verwendet". */
  lastOpenedAt?: number;
  source?: 'copyNpaste';
  capturedAt?: number;
}

// ── 1Clicker-Protokoll (Nutzungswege wie im 1Clicker-Werkzeugkasten) ────────

/**
 * Nutzungsweg eines Software-/Repository-Links:
 * - `checking`   — 🟠 Analyse läuft (statische Klassifikation + Hintergrund-Check)
 * - `online`     — 🟢 mit 1 Klick kostenlos im Browser nutzbar (Live-Anwendung)
 * - `local`      — 🔵 mit 1 Klick kostenlos lokal nutzbar (Docker/portable/START-1CLICKER)
 * - `none`       — analysiert, aber kein 1-Klick-Weg erkannt (keine Badge)
 */
export type ClickerStatus = 'checking' | 'online' | 'local' | 'none';

/** Art des erkannten Nutzungswegs. */
export type ClickerKind = 'repo' | 'web' | 'docker' | 'portable' | 'cmd';

export interface ClickerInfo {
  status: ClickerStatus;
  kind: ClickerKind;
  /** Zeitpunkt der letzten (versuchten) Analyse — epoch ms. */
  checkedAt?: number;
  /** 🟢 Klick-Ziel: Live-Anwendung (Homepage, GitHub-Pages-Demo, gehostete Instanz). */
  launchUrl?: string;
  /** 🔵 Repo-Koordinaten für die lokale Bereitstellung (Clone/Docker/Releases). */
  repo?: { owner: string; name: string; cloneUrl: string };
  /** Menschenlesbarer Grund des erkannten Nutzungswegs (Tooltip/Badge-Dialog). */
  reason?: string;
  /** Expliziter Nachweis des aKlik-Protokolls; Heuristiken bleiben Hinweise. */
  verified?: boolean;
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
  /** 1Clicker-Status-Engine: Repositories im Hintergrund analysieren (Netzwerk zu GitHub). */
  clickerEnabled: boolean;
  /** Echte Webseiten-Logos (Favicon-Kette Google S2 → Icon.horse) laden; aus = Buchstaben-Avatare. */
  faviconsEnabled: boolean;
  /** Add-on: beim Speichern optional Screenshot ziehen und per Vision-Modell verschlagworten. */
  visionOnSave: boolean;
  /** Vision-Modell (OpenAI-kompatibel, z. B. „glm-5.3-flash"). */
  visionModel: string;
  /** Wöchentliche lokale Auto-Sicherung (IndexedDB-Snapshots). */
  autoBackup: boolean;
}

export interface AppState {
  version: 3;
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

export type SmartViewKey =
  | 'today'
  | 'week'
  | 'github'
  | 'ki'
  | 'pinned'
  | 'uncategorized'
  | 'clicker-online'
  | 'clicker-local'
  | 'recent'
  | 'hunt';

export const SMART_VIEWS: { key: SmartViewKey; label: string; icon: string }[] = [
  { key: 'hunt', label: "Today's Hunt", icon: 'sparkles' },
  { key: 'today', label: 'Neu heute', icon: 'sparkles' },
  { key: 'week', label: 'Neu (7 Tage)', icon: 'clock' },
  { key: 'recent', label: 'Zuletzt verwendet', icon: 'history' },
  { key: 'github', label: 'GitHub', icon: 'github' },
  { key: 'ki', label: 'KI-Tools', icon: 'bot' },
  { key: 'pinned', label: 'Angepinnt', icon: 'pin' },
  { key: 'clicker-online', label: '1Clicker · Online', icon: 'zap' },
  { key: 'clicker-local', label: '1Clicker · Lokal', icon: 'monitor' },
  { key: 'uncategorized', label: 'Ohne Kategorie', icon: 'help' },
];

/** Sortier-Modi der Lesezeichenliste (persönlich speicherbar). */
export type SortMode = 'newest' | 'oldest' | 'title' | 'host' | 'popular' | 'recent';

export const SORT_MODES: { key: SortMode; label: string }[] = [
  { key: 'newest', label: 'Neueste zuerst' },
  { key: 'oldest', label: 'Älteste zuerst' },
  { key: 'title', label: 'Titel A–Z' },
  { key: 'host', label: 'Webseite A–Z' },
  { key: 'popular', label: 'Häufig verwendet' },
  { key: 'recent', label: 'Zuletzt verwendet' },
];
