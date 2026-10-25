/**
 * Intelligente Cross-Verlinkung (Cross-Mapping): Ein Link, der einer Gruppe
 * zugeordnet wird (Drag&Drop, Shortcut, manuell), wird über gemeinsame
 * Glossar-Begriffe automatisch in verwandten Gruppen als „verknüpft" angezeigt.
 *
 * Beispiel (Auftrag): Link → Gruppe „JayTX". Glossar sagt: JayTX gehört zu
 * „SMMA". „ROFLnator.90" gehört ebenfalls zu „SMMA" → der Link erscheint auch
 * bei „ROFLnator.90" als verknüpft (via SMMA).
 */
import type { AppState, Bookmark, Category, DynamicGroup, GlossaryEntry } from './types';
import { normTerm, termMatchesName } from './glossary';

export interface CrossLinkTarget {
  kind: 'category' | 'group';
  id: string;
  name: string;
  /** Gemeinsame(r) Begriff(e), über die die Verknüpfung läuft (z. B. „SMMA"). */
  via: string[];
}

interface RelatedMatch {
  otherTerm: string;
  via: string[];
}

/**
 * Findet für einen Glossar-Begriff alle anderen Begriffe, die mindestens ein
 * verwandtes Thema teilen. „SMMA" ∈ JayTX und ∈ „MEME SMMA" (ROFLnator.90)
 * → { otherTerm: 'ROFLnator.90', via: 'SMMA' }.
 */
export function relatedTermsSharingAttributes(term: string, glossary: GlossaryEntry[]): RelatedMatch[] {
  const own = glossary.find((g) => normTerm(g.term) === normTerm(term));
  if (!own) return [];
  const out: RelatedMatch[] = [];
  for (const other of glossary) {
    if (normTerm(other.term) === normTerm(own.term)) continue;
    const shared: string[] = [];
    for (const ownRel of own.related) {
      for (const otherRel of other.related) {
        // „SMMA" == „SMMA"; „SMMA" steckt auch in „MEME SMMA".
        if (termMatchesName(ownRel, otherRel) || termMatchesName(otherRel, ownRel)) {
          if (!shared.some((s) => normTerm(s) === normTerm(ownRel))) shared.push(ownRel);
        }
      }
    }
    if (shared.length > 0) out.push({ otherTerm: other.term, via: shared });
  }
  return out;
}

/** Ein Begriff (z. B. „SMMA") passt direkt zu Kategorie-/Gruppennamen? */
function targetsForName(name: string, categories: Category[], groups: DynamicGroup[]): CrossLinkTarget[] {
  const targets: CrossLinkTarget[] = [];
  for (const c of categories) {
    if (termMatchesName(name, c.name)) targets.push({ kind: 'category', id: c.id, name: c.name, via: [name] });
  }
  for (const g of groups) {
    if (termMatchesName(name, g.name)) targets.push({ kind: 'group', id: g.id, name: g.name, via: [name] });
  }
  return targets;
}

function mergeTargets(into: Map<string, CrossLinkTarget>, add: CrossLinkTarget[]): void {
  for (const t of add) {
    const key = `${t.kind}:${t.id}`;
    const existing = into.get(key);
    if (existing) {
      for (const v of t.via) {
        if (!existing.via.some((x) => normTerm(x) === normTerm(v))) existing.via.push(v);
      }
    } else {
      into.set(key, { ...t, via: [...t.via] });
    }
  }
}

/**
 * Berechnet alle Cross-Verlinkungen eines Lesezeichens:
 * 1. Direkte Kategorienamen gegen das Glossar matchen.
 * 2. Geteilte verwandte Themen finden (z. B. beide kennen „SMMA").
 * 3. Verwandte Begriffe + eigene verwandte Themen auf Kategorien/Gruppen mappen.
 */
export function crossLinksForBookmark(bm: Bookmark, state: AppState): CrossLinkTarget[] {
  const { categories, dynamicGroups, glossary } = state;
  if (glossary.length === 0) return [];

  const directCatIds = new Set(bm.categoryIds);
  const results = new Map<string, CrossLinkTarget>();

  const catById = new Map(categories.map((c) => [c.id, c]));
  const directNames = bm.categoryIds.map((id) => catById.get(id)?.name ?? '').filter(Boolean);

  for (const name of directNames) {
    // Eigene verwandte Themen des direkten Begriffs sind selbst Gruppen-Kandidaten.
    const own = glossary.find((g) => termMatchesName(g.term, name));
    if (own) {
      for (const rel of own.related) {
        mergeTargets(results, targetsForName(rel, categories, dynamicGroups).map((t) => ({ ...t, via: [rel] })));
      }
      // Zweite Stufe: andere Glossar-Begriffe mit gemeinsamen Themen (SMMA-Beispiel).
      for (const { otherTerm, via } of relatedTermsSharingAttributes(own.term, glossary)) {
        mergeTargets(results, targetsForName(otherTerm, categories, dynamicGroups).map((t) => ({ ...t, via })));
      }
    }
  }

  // Bereits direkt zugeordnete Ziele entfernen.
  for (const [key, t] of results) {
    if (t.kind === 'category' && directCatIds.has(t.id)) results.delete(key);
  }
  return [...results.values()];
}

/** Prüft, ob ein Lesezeichen über das Glossar mit einer Kategorie/Gruppe verknüpft ist. */
export function isCrossLinked(bm: Bookmark, state: AppState, kind: 'category' | 'group', id: string): CrossLinkTarget | undefined {
  return crossLinksForBookmark(bm, state).find((t) => t.kind === kind && t.id === id);
}

/** Für den Toast nach einer Zuordnung: kurze textuelle Cross-Link-Aufzählung. */
export function describeNewCrossLinks(bm: Bookmark, state: AppState): string {
  const links = crossLinksForBookmark(bm, state);
  return links
    .slice(0, 3)
    .map((t) => `${t.name} (via ${t.via[0]})`)
    .join(' · ');
}
