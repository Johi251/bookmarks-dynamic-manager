/**
 * Bestands-Analyse für den Statistik-Tab: Kennzahlen, Top-Listen und
 * Dubletten-Erkennung. Rein funktional, offline, deterministisch — testbar.
 */
import type { AppState, Bookmark, SortMode } from './types';
import { hostOf } from './host';

export interface Stats {
  total: number;
  categories: number;
  tags: number;
  /** Durchschnittliche Kategorien-Zuordnungen pro Lesezeichen (Multi-Kategorisierung). */
  avgCategories: number;
  /** Lesezeichen ohne jede Kategorie. */
  uncategorized: number;
  /** Verteilung nach Top-Level-Domain-Kern (z. B. „github", „youtube"). */
  topHosts: { host: string; count: number }[];
  /** Die meist genutzten Tags mit Anzahl. */
  topTags: { tag: string; count: number }[];
  /** Aktivität der letzten 12 Wochen (neue Lesezeichen pro Woche, älteste zuerst). */
  activity: number[];
  /** Summe aller Öffnungen (seit v1.4 getrackt). */
  totalOpens: number;
}

export function computeStats(state: AppState): Stats {
  const tagCounts = new Map<string, number>();
  const hostCounts = new Map<string, number>();
  let catRefs = 0;
  let uncategorized = 0;
  let totalOpens = 0;

  for (const bm of state.bookmarks) {
    for (const t of bm.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    const host = hostOf(bm.url);
    if (host) hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
    catRefs += bm.categoryIds.length;
    if (bm.categoryIds.length === 0) uncategorized++;
    totalOpens += bm.openedCount ?? 0;
  }

  // Aktivität: 12 Wochen-Raster, älteste Woche zuerst.
  const WEEK = 7 * 86_400_000;
  const now = Date.now();
  const activity = new Array<number>(12).fill(0);
  for (const bm of state.bookmarks) {
    const weeksAgo = Math.floor((now - bm.added) / WEEK);
    if (weeksAgo >= 0 && weeksAgo < 12) activity[11 - weeksAgo]++;
  }

  const topHosts = [...hostCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([host, count]) => ({ host, count }));
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count }));

  return {
    total: state.bookmarks.length,
    categories: state.categories.length,
    tags: tagCounts.size,
    avgCategories: state.bookmarks.length ? catRefs / state.bookmarks.length : 0,
    uncategorized,
    topHosts,
    topTags,
    activity,
    totalOpens,
  };
}

/** Eine gefundene Dublettengruppe (gleicher normalisierter URL-Kern). */
export interface DuplicateGroup {
  /** Normalisierter URL-Schlüssel der Gruppe. */
  key: string;
  bookmarks: Bookmark[];
}

/** Normalisiert eine URL für den Dubletten-Vergleich. */
export function normalizeUrlKey(url: string): string {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).href.replace(/\/$/, ''); }
  catch { return url; }
}

/** Nur dieselbe URL ist eine löschbare Dublette; gleiche Titel können verschiedene Seiten meinen. */
export function findDuplicates(bookmarks: Bookmark[]): DuplicateGroup[] {
  const byUrl = new Map<string, Bookmark[]>();
  for (const bm of bookmarks) {
    const key = normalizeUrlKey(bm.url);
    const members = byUrl.get(key) ?? [];
    members.push(bm); byUrl.set(key, members);
  }
  return [...byUrl].filter(([, members]) => members.length > 1).map(([key, members]) => ({
    key, bookmarks: [...members].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.openedCount ?? 0) - (a.openedCount ?? 0) || b.added - a.added),
  })).sort((a, b) => b.bookmarks.length - a.bookmarks.length);
}

/** Sortiert eine Lesezeichenliste nach dem gewählten Modus (angepinnt zuerst außer bei Titel/Host). */
export function sortBookmarks(list: Bookmark[], mode: SortMode): Bookmark[] {
  const byPinned = (a: Bookmark, b: Bookmark) => Number(b.pinned) - Number(a.pinned);
  const arr = [...list];
  switch (mode) {
    case 'oldest':
      return arr.sort((a, b) => byPinned(a, b) || a.added - b.added);
    case 'title':
      return arr.sort((a, b) => a.title.localeCompare(b.title, 'de'));
    case 'host':
      return arr.sort((a, b) => hostOf(a.url).localeCompare(hostOf(b.url), 'de') || a.title.localeCompare(b.title, 'de'));
    case 'popular':
      return arr.sort((a, b) => byPinned(a, b) || (b.openedCount ?? 0) - (a.openedCount ?? 0) || b.added - a.added);
    case 'recent':
      return arr.sort((a, b) => byPinned(a, b) || (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0) || b.added - a.added);
    case 'newest':
    default:
      return arr.sort((a, b) => byPinned(a, b) || b.added - a.added);
  }
}
