import type { CategorizeRule } from './types';

/** Ergebnis der automatischen Kategorisierung: Kategorienamen (Mehrfachzuordnung). */
export function categorize(
  url: string,
  title: string,
  folderPath: string[],
  rules: CategorizeRule[]
): { categories: string[]; matchedRuleIds: string[] } {
  let host = '';
  let pathAndTitle = '';
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    host = u.hostname.toLowerCase().replace(/^www\./, '');
    pathAndTitle = `${u.pathname} ${u.search} ${title}`.toLowerCase();
  } catch {
    pathAndTitle = `${url} ${title}`.toLowerCase();
  }

  const names: string[] = [];
  const matched: string[] = [];

  for (const rule of rules) {
    if (!rule.enabled || !rule.pattern) continue;
    const p = rule.pattern.toLowerCase();
    const hit = rule.kind === 'domain' ? host.includes(p) : `${host} ${pathAndTitle}`.includes(p);
    if (hit) {
      matched.push(rule.id);
      for (const name of rule.categories) {
        if (name && !names.includes(name)) names.push(name);
      }
    }
  }

  // Ordnerherkunft aus dem Browser-Import als zusätzliche Zuordnung (oberste Ebenen).
  for (const folder of folderPath.slice(0, 2)) {
    if (folder && !names.includes(folder)) names.push(folder);
  }

  // Fallback: keine Kategorie erkannt -> automatisch neue Kategorie je Domain anlegen,
  // damit nichts „ohne Kategorie" verloren geht (Wunsch: „wenn es keine Kategorie gibt, dann neue anlegen").
  if (names.length === 0 && host) {
    names.push(host);
  }
  if (names.length === 0) {
    names.push('Sonstige');
  }

  return { categories: names, matchedRuleIds: matched };
}
