/**
 * Favicon-Kette: lädt echte Webseiten-Logos (64×64) über eine Reihe von
 * Favicon-APIs mit sauberem Fallback. Scheitert keine API, erzeugt die
 * Komponente ein minimalistisches CSS-Icon aus dem Anfangsbuchstaben der
 * Domain (deterministisch gedeckte Farbpalette).
 *
 * Pro Host wird die funktionierende Quelle gecacht (localStorage), damit
 * ausgefallene Hosts nicht bei jedem Rendern erneut durch die Kette laufen.
 */

export type FaviconSource = 'google-s2' | 'icon-horse' | 'letter';

const CACHE_KEY = 'bdm-favicon-v1';

/** Favicon-Quellen in Kette-Reihenfolge (64×64). */
export function faviconUrl(source: FaviconSource, host: string): string {
  switch (source) {
    case 'google-s2':
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    case 'icon-horse':
      return `https://icon.horse/icon/${encodeURIComponent(host)}`;
    default:
      return '';
  }
}

/** Nächste Quelle in der Kette; nach der letzten → Buchstaben-Avatar. */
export function nextSource(source: FaviconSource): FaviconSource {
  return source === 'google-s2' ? 'icon-horse' : 'letter';
}

type FaviconCache = Record<string, FaviconSource>;

function readCache(): FaviconCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as FaviconCache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: FaviconCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignorieren */
  }
}

/** Gemerkte Quelle für einen Host (undefined = noch nicht probiert → Kette von vorn). */
export function cachedSource(host: string): FaviconSource | undefined {
  return readCache()[host];
}

/** Merkt sich die (fehl-)geschlagene Quelle eines Hosts. */
export function rememberSource(host: string, source: FaviconSource): void {
  const cache = readCache();
  cache[host] = source;
  // Cache schlank halten: nur die jüngsten 500 Hosts.
  const keys = Object.keys(cache);
  if (keys.length > 500) for (const k of keys.slice(0, keys.length - 500)) delete cache[k];
  writeCache(cache);
}

/** Kuratierte, gedeckte Avatar-Palette für den Buchstaben-Fallback. */
const AVATAR_COLORS = ['#5b6b8c', '#5f8477', '#7d6a9e', '#96744f', '#6d80a0', '#8a7460', '#578b90', '#7c7f94'];

/** Deterministische Farbe aus dem Hostnamen (gleicher Host → gleiche Farbe). */
export function avatarColorOf(host: string): string {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Normalisiert „www.example.de" → „example.de" für die API- und Avatar-Nutzung. */
export function faviconHostOf(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
