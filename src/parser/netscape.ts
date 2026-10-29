import { urlKey } from '../host';
import type { Bookmark, Category } from '../types';
import { uid } from '../rules';

/**
 * Parser für Netscape-Bookmark-HTML (Export-Format von Chrome, Firefox, Edge, Brave).
 * Liest Ordner (H3 + verschachtelte DL) und Links (A mit HREF, ADD_DATE, TAGS, ICON optional).
 */
export interface ParsedImport {
  bookmarks: Bookmark[];
  categories: Category[];
  skippedDuplicates: number;
}

/** Attribut case-insensitive lesen (Chrome schreibt HREF/ADD_DATE groß). */
function attr(el: Element, name: string): string | null {
  const direct = el.getAttribute(name);
  if (direct !== null) return direct;
  const lower = name.toLowerCase();
  for (const a of Array.from(el.attributes)) {
    if (a.name.toLowerCase() === lower) return a.value;
  }
  return null;
}

export function parseNetscapeHtml(html: string): ParsedImport {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const bookmarks: Bookmark[] = [];
  const categories: Category[] = [];
  const seen = new Set<string>();
  let skippedDuplicates = 0;

  // Chrome/FF Exporte kapseln die Lesezeichen in <DL><p>…</p></DL> direkt unter <BODY> (bzw. <DL>).
  const rootDl = doc.querySelector('dl') ?? doc.body;
  if (!rootDl) return { bookmarks, categories, skippedDuplicates };

  const catByName = new Map<string, Category>();
  const ensureCategory = (name: string, parentId: string | null, path: string): Category => {
    const key = path.toLowerCase();
    const existing = catByName.get(key);
    if (existing) return existing;
    const cat: Category = { id: uid('cat'), name, parentId, source: 'import' };
    catByName.set(key, cat);
    categories.push(cat);
    return cat;
  };

  const walk = (dl: Element, folderPath: string[], parentCatId: string | null) => {
    // Einige HTML-Parser (z. B. linkdom) betten die <DT>-Kinder in das offene <p>
    // des Chrome-Formats ein statt es zu schließen — <p> daher transparent behandeln.
    for (const dt of Array.from(dl.children)) {
      if (dt.tagName === 'P') {
        walk(dt, folderPath, parentCatId);
        continue;
      }
      if (dt.tagName !== 'DT') continue;
      const h3 = dt.querySelector(':scope > h3');
      const link = dt.querySelector(':scope > a');
      if (h3) {
        const name = (h3.textContent ?? '').trim() || 'Ordner';
        const cat = ensureCategory(name, parentCatId, [...folderPath, name].join('/'));
        const childDl = dt.querySelector(':scope > dl');
        if (childDl) walk(childDl, [...folderPath, name], cat.id);
        // Sonderfall toleranter Parser (z. B. linkedom): Links dieser Ebene
        // hängen statt als Geschwister in weiteren <p>-Kindern des Ordner-<dt>.
        for (const p of Array.from(dt.children)) {
          if (p.tagName === 'P') walk(p, [...folderPath, name], cat.id);
        }
      } else if (link) {
        const url = attr(link, 'href') ?? '';
        if (!url || !/^https?:/i.test(url)) continue;
        const key = urlKey(url);
        if (seen.has(key)) {
          skippedDuplicates++;
          continue;
        }
        seen.add(key);
        const addRaw = Number(attr(link, 'add_date') ?? '0');
        // ADD_DATE ist Unix-Sekunden; plausible Spanne prüfen, sonst „jetzt".
        const added = addRaw > 1_000_000_000 && addRaw * 1000 < Date.now() + 86_400_000
          ? addRaw * 1000
          : Date.now();
        const tags = (attr(link, 'tags') ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        bookmarks.push({
          id: uid('bm'),
          title: (link.textContent ?? '').trim() || url,
          url,
          added,
          tags,
          categoryIds: parentCatId ? [parentCatId] : [],
          pinned: false,
        });
      }
    }
  };

  walk(rootDl, [], null);
  return { bookmarks, categories, skippedDuplicates };
}
