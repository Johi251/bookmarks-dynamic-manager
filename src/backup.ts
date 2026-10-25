/**
 * Auto-Backup-Routine: vollständig lokale, wöchentliche Sicherung des
 * erweiterten Datenmodells als Snapshots in IndexedDB (funktioniert in
 * Web-App, Tauri-Desktop und MV3-Add-on) plus Export/Import des gesamten
 * Modells als strukturierte JSON- und CSV-Datei.
 */
import type { AppState, Bookmark } from './types';
import { classifyClicker } from './oneclicker';

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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
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
  return lastBackupAt === null || now - lastBackupAt >= BACKUP_EVERY_MS;
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
  if (!state.settings.autoBackup) return null;
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
    for (const old of all.slice(0, Math.max(0, all.length - BACKUP_KEEP))) {
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
] as const;

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Exportiert den kompletten Zustand als strukturierte CSV (Semikolon, UTF-8-BOM). */
export function exportCsv(state: AppState): string {
  const catById = new Map(state.categories.map((c) => [c.id, c.name]));
  const rows: string[] = [CSV_COLUMNS.map(csvEscape).join(';')];
  for (const bm of [...state.bookmarks].sort((a, b) => b.added - a.added)) {
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
      ]
        .map(csvEscape)
        .join(';')
    );
  }
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

function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export interface CsvImport {
  bookmarks: Bookmark[];
  /** Kategorienamen, die beim Import angelegt/verbunden werden sollen. */
  categoryNames: string[];
  skipped: number;
}

/**
 * Importiert eine CSV (Export dieser App oder eine einfache Link-Liste mit
 * den Spalten Titel/URL). Kategorien und 1Clicker-Status werden übernommen;
 * fehlende Zeitstempel erhalten „jetzt".
 */
export function importCsv(text: string): CsvImport {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = clean.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return { bookmarks: [], categoryNames: [], skipped: 0 };

  const delim = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delim).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());
  const iTitle = idx('titel') >= 0 ? idx('titel') : idx('title');
  const iUrl = idx('url');
  const iAdded = idx('hinzugefügt') >= 0 ? idx('hinzugefügt') : idx('added');
  const iTags = idx('tags');
  const iCats = idx('kategorien') >= 0 ? idx('kategorien') : idx('categories');
  const iPinned = idx('angepinnt') >= 0 ? idx('angepinnt') : idx('pinned');
  const iNote = idx('notiz') >= 0 ? idx('notiz') : idx('note');
  const iStatus = idx('1clicker-status');
  const iKind = idx('1clicker-weg');
  const iLaunch = idx('live-app');

  const bookmarks: Bookmark[] = [];
  const categoryNames = new Set<string>();
  let skipped = 0;
  const seenUrls = new Set<string>();

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line, delim);
    const url = (iUrl >= 0 ? cells[iUrl] : '').trim();
    if (!/^https?:\/\//i.test(url)) {
      skipped++;
      continue;
    }
    const key = url.toLowerCase().replace(/\/$/, '');
    if (seenUrls.has(key)) {
      skipped++;
      continue;
    }
    seenUrls.add(key);
    const title = (iTitle >= 0 ? cells[iTitle] : '').trim() || url;
    const addedRaw = iAdded >= 0 ? cells[iAdded] : '';
    const added = addedRaw && !Number.isNaN(Date.parse(addedRaw)) ? Date.parse(addedRaw) : Date.now();
    const tags = (iTags >= 0 ? cells[iTags] : '')
      .split('|')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const cats = (iCats >= 0 ? cells[iCats] : '')
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    cats.forEach((c) => categoryNames.add(c));
    const status = iStatus >= 0 ? cells[iStatus].trim() : '';
    const kind = (iKind >= 0 ? cells[iKind] : '').trim();
    const launch = (iLaunch >= 0 ? cells[iLaunch] : '').trim();
    const clicker =
      status === 'online' || status === 'local' || status === 'checking'
        ? {
            status: status as 'online' | 'local' | 'checking',
            kind: (kind === 'docker' || kind === 'portable' || kind === 'cmd' || kind === 'web' || kind === 'repo' ? kind : 'web') as
              | 'docker' | 'portable' | 'cmd' | 'web' | 'repo',
            launchUrl: /^https?:\/\//.test(launch) ? launch : undefined,
          }
        : classifyClicker(url, title, tags);

    bookmarks.push({
      id: `csv-${seenUrls.size}-${Date.now().toString(36)}`,
      title,
      url,
      added,
      tags,
      categoryIds: [],
      pinned: (iPinned >= 0 ? cells[iPinned] : '').trim().toLowerCase() === 'ja' || cells[iPinned]?.trim().toLowerCase() === 'true',
      note: (iNote >= 0 ? cells[iNote] : '').trim() || undefined,
      clicker,
    });
  }

  return { bookmarks, categoryNames: [...categoryNames], skipped };
}
