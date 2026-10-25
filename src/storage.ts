import type { AppSettings, AppState, Bookmark } from './types';
import { createSeedState } from './rules';
import { classifyClicker } from './oneclicker';

const STORAGE_KEY = 'bdm-state-v1';
/** Der API-Schlüssel liegt bewusst AUSSERHALB des App-Zustands, damit er
    niemals im JSON-Export landt (Export = öffentliche Datei). */
const AI_KEY_STORAGE = 'bdm-ai-key';

/** Speicher-Backend: Web/Desktop = localStorage, Browser-Add-on = chrome.storage.local. */
export type StorageKind = 'local' | 'extension';

interface ChromeLikeStorageArea {
  get(keys: string | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}
interface ChromeLikeStorageEvent {
  addListener(listener: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void): void;
  removeListener(listener: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void): void;
}
interface ChromeLike {
  storage?: {
    local: ChromeLikeStorageArea;
    onChanged: ChromeLikeStorageEvent;
  };
}

const chromeApi: ChromeLike | undefined = (globalThis as { chrome?: ChromeLike }).chrome;

export function storageKind(): StorageKind {
  return chromeApi?.storage?.local ? 'extension' : 'local';
}

export const DEFAULT_SETTINGS: AppSettings = {
  favorites: [],
  startMinimized: false,
  aiProvider: 'local',
  aiEndpoint: '',
  aiModel: '',
  clickerEnabled: true,
  faviconsEnabled: true,
  visionOnSave: false,
  visionModel: 'glm-5.3-flash',
  autoBackup: true,
};

/**
 * Führt alte Zustände (v1/v2) und unvollständige v3-Zustände auf das volle
 * v3-Modell. v2 → v3: statische 1Clicker-Klassifikation für alle Software-/
 * Repository-Links (Repository-Links starten auf „checking" und werden im
 * Hintergrund verfeinert); neue Einstellungen erhalten ihre Defaults.
 */
export function migrateState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<AppState> & { version?: number };
  if (!Array.isArray(parsed.bookmarks) || !Array.isArray(parsed.categories)) return null;
  const oldVersion = parsed.version ?? 1;
  return {
    version: 3,
    // Tag-Bereinigung (idempotent): normalisieren, deduplizieren, Teil-Tag-Varianten
    // entfernen („open"/„lyric" neben „openai"/„lyric-videos") — korrigiert auch
    // Bestände, die mit einer älteren Engine-Version erzeugt wurden.
    // Bei v2 → v3 zusätzlich: statische 1Clicker-Nutzungsweg-Klassifikation.
    bookmarks: parsed.bookmarks.map((b) => upgradeClicker(cleanBookmarkTags(b), oldVersion)),
    categories: parsed.categories,
    rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    glossary: Array.isArray(parsed.glossary) ? parsed.glossary : [],
    dynamicGroups: Array.isArray(parsed.dynamicGroups) ? parsed.dynamicGroups : [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
  };
}

/** v2 → v3: hängt fehlende 1Clicker-Infos an (idempotent — bestehende bleiben). */
function upgradeClicker(bm: Bookmark, oldVersion: number): Bookmark {
  if (oldVersion >= 3 && bm.clicker !== undefined) return bm;
  const info = classifyClicker(bm.url, bm.title, bm.tags);
  return info ? { ...bm, clicker: info } : bm;
}

function cleanBookmarkTags(bm: Bookmark): Bookmark {
  if (!Array.isArray(bm.tags) || bm.tags.length === 0) return bm;
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of bm.tags) {
    const t = String(raw).toLowerCase().trim().replace(/\s+/g, '-');
    if (t && !seen.has(t)) {
      seen.add(t);
      normalized.push(t);
    }
  }
  const cleaned = normalized.filter((t) => !(t.length >= 4 && normalized.some((o) => o !== t && o.length > t.length && o.includes(t))));
  return cleaned.length === bm.tags.length && cleaned.every((t, i) => t === bm.tags[i]) ? bm : { ...bm, tags: cleaned };
}

function readLocal(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = migrateState(JSON.parse(raw));
      if (parsed) return parsed;
    }
    return createSeedState();
  } catch {
    return createSeedState();
  }
}

/** Lädt den Zustand asynchron (Extension: chrome.storage; sonst localStorage). */
export async function loadStateAsync(): Promise<AppState> {
  if (chromeApi?.storage?.local) {
    try {
      const bag = await chromeApi.storage.local.get(STORAGE_KEY);
      const parsed = migrateState(bag[STORAGE_KEY]);
      if (parsed) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); // Cache für direkte Reads
        } catch {
          /* ignorieren */
        }
        return parsed;
      }
      return createSeedState();
    } catch {
      return readLocal();
    }
  }
  return readLocal();
}

/** Speichert synchron (Web: localStorage; Extension: chrome.storage + lokaler Cache). */
export function saveStateSync(state: AppState): boolean {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Speichern fehlgeschlagen', err);
    }
  }
  if (chromeApi?.storage?.local) {
    void chromeApi.storage.local.set({ [STORAGE_KEY]: state }).catch((err: unknown) =>
      console.error('chrome.storage schreiben fehlgeschlagen', err)
    );
  }
  return true;
}

/** Abonniert externe Änderungen (Extension: chrome.storage.onChanged; Web: storage-Event anderer Tabs). */
export function subscribeChanges(cb: (state: AppState) => void): () => void {
  const listener = (next: AppState | null | undefined) => {
    const parsed = next ? migrateState(next) : null;
    if (parsed) cb(parsed);
  };
  if (chromeApi?.storage?.onChanged) {
    const handler = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes[STORAGE_KEY]) listener(changes[STORAGE_KEY].newValue as AppState | undefined);
    };
    chromeApi.storage.onChanged.addListener(handler);
    return () => chromeApi.storage!.onChanged.removeListener(handler);
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        listener(JSON.parse(e.newValue) as AppState);
      } catch {
        /* ignorieren */
      }
    }
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

export function clearState(): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignorieren */
    }
  }
  if (chromeApi?.storage?.local) {
    void chromeApi.storage.local.remove(STORAGE_KEY).catch(() => undefined);
  }
}

// ── KI-API-Schlüssel (separat vom Zustand, nie im Export) ──────────────────

export function getAiApiKey(): string {
  try {
    return localStorage.getItem(AI_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setAiApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(AI_KEY_STORAGE, key);
    else localStorage.removeItem(AI_KEY_STORAGE);
  } catch {
    /* ignorieren */
  }
}
