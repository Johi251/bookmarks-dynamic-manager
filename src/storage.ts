import type { AppState } from './types';
import { createSeedState } from './rules';

const STORAGE_KEY = 'bdm-state-v1';

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

function sanitize(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as AppState;
  if (parsed.version !== 1 || !Array.isArray(parsed.bookmarks) || !Array.isArray(parsed.categories)) return null;
  return { ...parsed, rules: Array.isArray(parsed.rules) ? parsed.rules : [] };
}

function readLocal(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = sanitize(JSON.parse(raw));
      if (parsed) return parsed;
    }
    // Fallback-Cache des Add-ons mitlesen (falls chrome.storage noch nicht gelesen wurde)
    if (chromeApi?.storage?.local) {
      return createSeedState();
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
      const parsed = sanitize(bag[STORAGE_KEY]);
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
    const parsed = next ? sanitize(next) : null;
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
