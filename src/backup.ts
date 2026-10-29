/**
 * Auto-Backup-Routine: vollständig lokale, wöchentliche Sicherung des
 * erweiterten Datenmodells als Snapshots in IndexedDB (funktioniert in
 * Web-App, Tauri-Desktop und MV3-Add-on) plus Export/Import des gesamten
 * Modells als strukturierte JSON- und CSV-Datei.
 */
import type { AppState, Bookmark } from './types';
import { classifyClicker } from './oneclicker';
import { migrateState, isWebUrl } from './storage';
import { createSeedState, uid } from './rules';
import { mapNamesToIds } from './applyBookmark';

export const BACKUP_EVERY_MS = 7 * 86_400_000;
/** Behaltene Wochen-Snapshots (≈ 2 Monate Historie). */
export const BACKUP_KEEP = 8;
const LAST_BACKUP_KEY = 'bdm-last-backup';

// ── Wöchentliche Snapshot-Routine (IndexedDB) ────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('bdm-backups', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots'); // key = ISO-Datum
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idb(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('snapshots', mode);
    const req = run(tx.objectStore('snapshots'));
    tx.oncomplete = () => resolve(req.result);
    tx.onabort = () => reject(tx.error ?? new Error('Snapshot-Transaktion abgebrochen'));
    tx.onerror = () => reject(tx.error);
  });
}

export interface BackupSnapshot {
  date: string; // ISO-Datum (Schlüssel)
  createdAt: number;
  bookmarkCount: number;
  state: AppState;
}

/** True, wenn die letzte Sicherung älter als eine Woche ist (reine Logik, testbar). */
export function isBackupDue(lastBackupAt: number | null, now = Date.now()): boolean {
  return lastBackupAt === null || !Number.isFinite(lastBackupAt) || now - lastBackupAt >= BACKUP_EVERY_MS;
}

function readLastBackup(): number | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Legt — falls fällig — einen Wochen-Snapshot an und räumt alte Snapshots.
 * Läuft bewusst fehlertolerant: ohne IndexedDB (selten) wird nur der
 * Zeitstempel nicht gesetzt, die App arbeitet normal weiter.
 */
export async function ensureWeeklyBackup(state: AppState): Promise<BackupSnapshot | null> {
  if (!state.settings.autoBackup || state.bookmarks.length === 0) return null;
  if (!isBackupDue(readLastBackup())) return null;
  const snapshot = await writeSnapshot(state);
  return snapshot;
}

/** Schreibt einen Snapshot sofort („Jetzt sichern") und räumt alte. */
export async function writeSnapshot(state: AppState): Promise<BackupSnapshot> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const snapshot: BackupSnapshot = { date, createdAt: now.getTime(), bookmarkCount: state.bookmarks.length, state };
  const db = await openDb();
  try {
    await idb(db, 'readwrite', (s) => s.put(snapshot, date));
    const all = await listSnapshots();
    for (const old of all.slice(BACKUP_KEEP)) {
      await idb(db, 'readwrite', (s) => s.delete(old.date));
    }
  } finally {
    db.close();
  }
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(now.getTime()));
  } catch {
    /* ignorieren */
  }
  return snapshot;
}

/** Alle Snapshots, neueste zuerst. */
export async function listSnapshots(): Promise<BackupSnapshot[]> {
  try {
    const db = await openDb();
    try {
      const all = (await idb(db, 'readonly', (s) => s.getAll())) as BackupSnapshot[];
      return all.sort((a, b) => b.createdAt - a.createdAt);
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

export async function deleteSnapshot(date: string): Promise<void> {
  const db = await openDb();
  try {
    await idb(db, 'readwrite', (s) => s.delete(date));
  } finally {
    db.close();
  }
}

// ── CSV-Export/-Import des erweiterten Datenmodells ─────────────────────────

/** Feld-Reihenfolge des CSV-Exports (Excel-DE: Semikolon + BOM). */
export const CSV_COLUMNS = [
  'Titel', 'URL', 'Hinzugefügt', 'Tags', 'Kategorien', 'Angepinnt', 'Notiz', '1Clicker-Status', '1Clicker-Weg', 'Live-App',
  'Lesezeichen-Daten', 'App-Daten',
] as const;

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Exportiert den kompletten Zustand als strukturierte CSV (Semikolon, UTF-8-BOM). */
export function exportCsv(state: AppState): string {
  const catById = new Map(state.categories.map((c) => [c.id, c.name]));
  const rows: string[] = [CSV_COLUMNS.map(csvEscape).join(';')];
  const { bookmarks, ...metadata } = state;
  const sorted = [...bookmarks].sort((a, b) => b.added - a.added);
  for (const [i, bm] of sorted.entries()) {
    rows.push(
      [
        bm.title,
        bm.url,
        new Date(bm.added).toISOString(),
        bm.tags.join('|'),
        bm.categoryIds.map((id) => catById.get(id) ?? '').filter(Boolean).join('|'),
        bm.pinned ? 'ja' : 'nein',
        bm.note ?? '',
        bm.clicker?.status ?? '',
        bm.clicker?.kind ?? '',
        bm.clicker?.launchUrl ?? '',
        JSON.stringify(bm),
        i === 0 ? JSON.stringify(metadata) : '',
      ]
        .map(csvEscape)
        .join(';')
    );
  }
  if (sorted.length === 0) rows.push([...Array<string>(11).fill(''), JSON.stringify(metadata)].map(csvEscape).join(';'));
  return '\uFEFF' + rows.join('\r\n');
}

/** Erkennt das Trennzeichen einer CSV-Datei anhand der Kopfzeile. */
export function detectDelimiter(headerLine: string): ';' | ',' | '\t' {
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of headerLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return (best?.[1] ?? 0) > 0 ? (best[0] as ';' | ',' | '\t') : ';';
}

/** Liest Datensätze statt Textzeilen: zitierte Felder dürfen Zeilenumbrüche enthalten. */
export function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"' && value === '') quoted = true;
    else if (ch === delim) { row.push(value); value = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(value); if (row.some((v) => v.trim())) rows.push(row); row = []; value = ''; }
    else value += ch;
  }
  if (quoted) throw new Error('CSV enthält ein nicht geschlossenes Anführungszeichen.');
  row.push(value);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

export interface CsvImport {
  bookmarks: Bookmark[];
  categoryNames: string[];
  skipped: number;
  state: AppState;  fullState: boolean;
}

/** Vollständiger CSV-Roundtrip; einfache Titel/URL-Listen bleiben kompatibel. */
export function importCsv(text: string): CsvImport {
  const clean = text.replace(/^\uFEFF/, '');
  const rows = parseCsv(clean, detectDelimiter(clean.split('\n')[0] ?? ''));
  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  const cell = (row: string[], ...names: string[]): string => {
    const index = names.map((name) => header.indexOf(name)).find((i) => i >= 0);
    return index === undefined ? '' : row[index] ?? '';
  };
  if (!header.includes('url')) throw new Error('CSV benötigt eine URL-Spalte.');
  const meta = rows.map((r) => cell(r, 'app-daten')).find(Boolean);
  let state = meta ? migrateState({ ...JSON.parse(meta), bookmarks: [] }) : { ...createSeedState(), categories: [], bookmarks: [] };
  if (!state) throw new Error('Ungültige CSV-App-Daten.');
  const bookmarks: Bookmark[] = [], categoryNames = new Set<string>(), seen = new Set<string>();
  let skipped = 0;
  for (const row of rows) {
    const url = cell(row, 'url').trim();
    if (!url && cell(row, 'app-daten')) continue;
    if (!isWebUrl(url)) { skipped++; continue; }
    const key = new URL(url).href.replace(/\/$/, '');
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    const originalText = cell(row, 'lesezeichen-daten');
    const original = originalText ? JSON.parse(originalText) as Bookmark : undefined;
    const cats = cell(row, 'kategorien', 'categories').split('|').map((c) => c.trim()).filter(Boolean);
    cats.forEach((c) => categoryNames.add(c));
    const originalNames = original?.categoryIds?.map((id) => state!.categories.find((c) => c.id === id)?.name ?? '') ?? [];
    let categoryIds: string[];
    if (original && originalNames.join('|') === cats.join('|')) categoryIds = original.categoryIds;
    else { const mapped = mapNamesToIds(cats, state); state = mapped.state; categoryIds = mapped.ids; }
    const tagText = cell(row, 'tags');
    const tags = original && original.tags.join('|') === tagText ? original.tags : tagText.split('|').map((t) => t.trim()).filter(Boolean);
    const status = cell(row, '1clicker-status'), kind = cell(row, '1clicker-weg'), launch = cell(row, 'live-app');
    const addedText = cell(row, 'hinzugefügt', 'added');
    const clicker = original?.clicker ?? (['online', 'local', 'checking', 'none'].includes(status) ? {
      status: status as NonNullable<Bookmark['clicker']>['status'],
      kind: (['docker', 'portable', 'cmd', 'web', 'repo'].includes(kind) ? kind : 'web') as NonNullable<Bookmark['clicker']>['kind'],
      launchUrl: isWebUrl(launch) ? launch : undefined,
    } : classifyClicker(url, cell(row, 'titel', 'title'), tags));
    bookmarks.push({
      ...original, id: original?.id ?? uid('csv'), url,
      title: cell(row, 'titel', 'title') || url,
      added: addedText && Number.isFinite(Date.parse(addedText)) ? Date.parse(addedText) : Date.now(),
      tags, categoryIds, pinned: ['ja', 'true'].includes(cell(row, 'angepinnt', 'pinned').trim().toLowerCase()),
      note: cell(row, 'notiz', 'note') || undefined, clicker,
    });
  }
  const validated = migrateState({ ...state, bookmarks });
  if (!validated) throw new Error('CSV enthält ungültige Lesezeichen-Daten.');
  return { bookmarks: validated.bookmarks, categoryNames: [...categoryNames], skipped, state: validated, fullState: !!meta };
}
