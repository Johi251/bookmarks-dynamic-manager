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
  if (parsed.version !== undefined && ![1, 2, 3].includes(parsed.version)) return null;
  if (!validStateData(parsed)) return null;
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

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export function isWebUrl(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) && !!u.hostname && !u.username && !u.password; }
  catch { return false; }
}

function validStateData(s: Record<string, unknown>): boolean {
  const cats = s.categories as unknown[];
  if (!cats.every((c) => record(c) && typeof c.id === 'string' && !!c.id && typeof c.name === 'string' &&
    (c.parentId === null || typeof c.parentId === 'string') && ['import', 'auto', 'manual', 'rule', 'seed'].includes(String(c.source)))) return false;
  const parents = new Map(cats.map((c) => [(c as CategoryData).id, (c as CategoryData).parentId]));
  if (parents.size !== cats.length) return false;
  for (const [id, parent] of parents) {
    const seen = new Set([id]);
    let cur = parent;
    while (cur !== null) {
      if (!parents.has(cur) || seen.has(cur)) return false;
      seen.add(cur); cur = parents.get(cur)!;
    }
  }
  const ids = new Set<string>();
  if (!(s.bookmarks as unknown[]).every((b) => {
    if (!record(b) || typeof b.id !== 'string' || !b.id || ids.has(b.id) || typeof b.title !== 'string' ||
      !isWebUrl(b.url) || !finite(b.added) || !strings(b.tags) || !strings(b.categoryIds) ||
      b.categoryIds.some((id) => !parents.has(id)) || typeof b.pinned !== 'boolean' ||
      (b.note !== undefined && typeof b.note !== 'string') ||
      (b.openedCount !== undefined && !finite(b.openedCount)) || (b.lastOpenedAt !== undefined && !finite(b.lastOpenedAt)) ||
      (b.capturedAt !== undefined && !finite(b.capturedAt)) || (b.source !== undefined && b.source !== 'copyNpaste')) return false;
    ids.add(b.id);
    if (b.clicker !== undefined) {
      const c = b.clicker;
      if (!record(c) || !['checking', 'online', 'local', 'none'].includes(String(c.status)) ||
        !['repo', 'web', 'docker', 'portable', 'cmd'].includes(String(c.kind)) ||
        (c.launchUrl !== undefined && !isWebUrl(c.launchUrl)) ||
        (c.checkedAt !== undefined && !finite(c.checkedAt)) ||
        (c.reason !== undefined && typeof c.reason !== 'string') ||
        (c.verified !== undefined && typeof c.verified !== 'boolean') ||
        (c.repo !== undefined && (!record(c.repo) || typeof c.repo.owner !== 'string' || typeof c.repo.name !== 'string' || !isWebUrl(c.repo.cloneUrl)))) return false;
    }
    return true;
  })) return false;
  const arrays: [string, (x: Record<string, unknown>) => boolean][] = [
    ['rules', (r) => ['domain', 'keyword'].includes(String(r.kind)) && typeof r.pattern === 'string' && strings(r.categories) && typeof r.enabled === 'boolean'],
    ['glossary', (g) => typeof g.term === 'string' && typeof g.definition === 'string' && strings(g.related) && finite(g.createdAt)],
    ['dynamicGroups', (g) => typeof g.name === 'string' && strings(g.terms) && finite(g.createdAt)],
  ];
  for (const [key, validate] of arrays) {
    if (s[key] === undefined) continue;
    const seen = new Set();
    if (!Array.isArray(s[key]) || !(s[key] as unknown[]).every((x) => {
      if (!record(x) || typeof x.id !== 'string' || !x.id || seen.has(x.id) || !validate(x)) return false;
      seen.add(x.id); return true;
    })) return false;
  }
  if (s.settings !== undefined) {
    if (!record(s.settings)) return false;
    for (const [key, value] of Object.entries(s.settings)) {
      if (key === 'favorites' ? !strings(value) : key in DEFAULT_SETTINGS && typeof value !== typeof DEFAULT_SETTINGS[key as keyof AppSettings]) return false;
    }
    if (s.settings.aiProvider !== undefined && !['local', 'api'].includes(String(s.settings.aiProvider))) return false;
  }
  return true;
}
type CategoryData = { id: string; parentId: string | null };

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
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createSeedState();
  const parsed = migrateState(JSON.parse(raw));
  if (!parsed) throw new Error('Gespeicherte Daten sind ungültig. Der vorhandene Bestand wurde nicht überschrieben.');
  return parsed;
}

/** Lädt den Zustand asynchron (Extension: chrome.storage; sonst localStorage). */
export async function loadStateAsync(): Promise<AppState> {
  if (chromeApi?.storage?.local) {
      const bag = await chromeApi.storage.local.get(STORAGE_KEY);
      if (bag[STORAGE_KEY] === undefined) return createSeedState();
      const parsed = migrateState(bag[STORAGE_KEY]);
      if (parsed) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); // Cache für direkte Reads
        } catch {
          /* ignorieren */
        }
        return parsed;
      }
      throw new Error('Gespeicherte Add-on-Daten sind ungültig. Bitte eine gültige JSON-Sicherung importieren.');
  }
  return readLocal();
}

/** Speichert synchron (Web: localStorage; Extension: chrome.storage + lokaler Cache). */
export async function saveState(state: AppState): Promise<void> {
  if (!migrateState(state)) throw new Error('Ungültiger Zustand wurde nicht gespeichert.');
  if (chromeApi?.storage?.local) {
    await chromeApi.storage.local.set({ [STORAGE_KEY]: state });
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
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

// ── KI-API-Schlüssel (separat vom Zustand, nie im Export) ──────────────────

export async function getAiApiKey(): Promise<string> {
  if (chromeApi?.storage?.local) {
    const bag = await chromeApi.storage.local.get(AI_KEY_STORAGE);
    if (typeof bag[AI_KEY_STORAGE] === 'string') return bag[AI_KEY_STORAGE];
    // Alte Add-on-Versionen speicherten den Schlüssel nur im Manager-Fenster.
    const old = typeof localStorage !== 'undefined' ? localStorage.getItem(AI_KEY_STORAGE) : null;
    if (old) await chromeApi.storage.local.set({ [AI_KEY_STORAGE]: old });
    return old ?? '';
  }
  return localStorage.getItem(AI_KEY_STORAGE) ?? '';
}

export async function setAiApiKey(key: string): Promise<void> {
  if (chromeApi?.storage?.local) {
    if (key) await chromeApi.storage.local.set({ [AI_KEY_STORAGE]: key });
    else await chromeApi.storage.local.remove(AI_KEY_STORAGE);
  } else {
    if (key) localStorage.setItem(AI_KEY_STORAGE, key);
    else localStorage.removeItem(AI_KEY_STORAGE);
  }
}
