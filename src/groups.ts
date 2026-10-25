/**
 * Dynamische Gruppen („Hashtag-Manager"): Eine Gruppe wie „#TOP KI" scannt
 * autonom den Bestand und nimmt jedes Lesezeichen auf, das zu ihren Match-Terms
 * passt. Terme mit „#" matchen nur Tags, andere den freien Text.
 */
import type { Bookmark, Category, DynamicGroup } from './types';

export const normTag = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

/**
 * Leitet aus einem Gruppennamen Vorschlags-Terms ab:
 * „#TOP KI" → ['#top', 'ki'], „#smma" → ['#smma'].
 */
export function termsFromName(name: string): string[] {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const terms: string[] = [];
  for (const p of parts) {
    if (p.startsWith('#')) {
      if (p.length > 1) terms.push(p.toLowerCase());
    } else if (p.length >= 2) {
      terms.push(p.toLowerCase());
    }
  }
  return terms;
}

function wordMatch(haystack: string, term: string): boolean {
  if (term.length >= 5) return haystack.includes(term); // lange Terme: Teilstring genügt
  const re = new RegExp(`(^|[^a-z0-9äöüß])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9äöüß]|$)`, 'i');
  return re.test(haystack); // kurze Terme: Wortgrenze, damit „ki" nicht „kino" trifft
}

/** Gehört das Lesezeichen zur dynamischen Gruppe? */
export function bookmarkMatchesGroup(bm: Bookmark, group: DynamicGroup, categories: Category[]): boolean {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const text = `${bm.title} ${bm.url} ${bm.note ?? ''} ${bm.tags.join(' ')} ${bm.categoryIds
    .map((id) => catById.get(id)?.name ?? '')
    .join(' ')}`.toLowerCase();

  for (const raw of group.terms) {
    const term = raw.toLowerCase();
    if (!term) continue;
    if (term.startsWith('#')) {
      const tag = normTag(term.slice(1));
      if (tag && bm.tags.some((t) => normTag(t) === tag)) return true;
    } else if (wordMatch(text, term)) {
      return true;
    }
  }
  return false;
}

/** Passende Tags, um ein Lesezeichen in eine Gruppe aufzunehmen (für Drag&Drop auf die Gruppe). */
export function tagTermsForGroup(group: DynamicGroup): string[] {
  const hash = group.terms.filter((t) => t.startsWith('#')).map((t) => normTag(t.slice(1)));
  if (hash.length > 0) return [...new Set(hash)];
  const plain = group.terms.filter((t) => !t.startsWith('#')).map(normTag);
  return [...new Set(plain)].slice(0, 1);
}
