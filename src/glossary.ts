/**
 * Glossar-Logik: Begriffs-Ketten des Nutzers (z. B. „JayTX → Musiker Business,
 * SMMA, Lyric Videos") und Matching gegen Titel, Hosts und Kategorienamen.
 */
import type { Bookmark, Category, GlossaryEntry } from './types';

export const normTerm = (s: string): string => s.toLowerCase().trim();

/** Wort-Token eines Begriffs („MEME SMMA" → {meme, smma}). */
export function termTokens(s: string): Set<string> {
  return new Set(
    normTerm(s)
      .split(/[^a-z0-9äöüß.]+/)
      .filter(Boolean)
  );
}

/**
 * True, wenn Begriff `term` zu `name` passt — per exakter Übereinstimmung oder
 * als ganzes Wort (Token). Roh-Substring ist bewusst NICHT erlaubt, damit
 * Kurzformen wie „ki" nicht „Kino" oder „Marketing" fälschlich treffen.
 */
export function termMatchesName(term: string, name: string): boolean {
  const t = normTerm(term);
  const n = normTerm(name);
  if (!t || !n) return false;
  if (n === t) return true;
  const tt = termTokens(term);
  const nt = termTokens(name);
  if (tt.size === 0 || nt.size === 0) return false;
  for (const token of tt) {
    if (nt.has(token)) return true;
  }
  return false;
}

export function findEntryByTerm(glossary: GlossaryEntry[], term: string): GlossaryEntry | undefined {
  return glossary.find((g) => normTerm(g.term) === normTerm(term));
}

/** Alle Glossar-Einträge, deren Begriff (oder ein verwandter Begriff) im Text vorkommt. */
export function matchGlossary(text: string, glossary: GlossaryEntry[]): { entry: GlossaryEntry; via: string }[] {
  const hay = normTerm(text);
  const hits: { entry: GlossaryEntry; via: string }[] = [];
  for (const entry of glossary) {
    const term = normTerm(entry.term);
    if (term && hay.includes(term)) {
      hits.push({ entry, via: entry.term });
      continue;
    }
    for (const rel of entry.related) {
      if (normTerm(rel) && hay.includes(normTerm(rel))) {
        hits.push({ entry, via: rel });
        break;
      }
    }
  }
  return hits;
}

/** Sucht einen Bookmark-Text (Titel + URL) gegen das Glossar. */
export function matchBookmarkGlossary(bm: Bookmark, glossary: GlossaryEntry[]): { entry: GlossaryEntry; via: string }[] {
  return matchGlossary(`${bm.title} ${bm.url} ${bm.tags.join(' ')}`, glossary);
}

/** Glossar-Hauptgruppen: Begriffe, für die es bereits eine passende Kategorie gibt. */
export function glossaryMainGroups(glossary: GlossaryEntry[], categories: Category[]): GlossaryEntry[] {
  return glossary.filter((g) => categories.some((c) => termMatchesName(g.term, c.name)));
}
