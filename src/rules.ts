import type { AppState, CategorizeRule } from './types';

/**
 * Standard-Kategorieregeln — transparent, offline, kostenfrei.
 * Abgestimmt auf die gewünschte Struktur (KI / KI-Agenten-Tools /
 * Hermes-Erweiterungen / GitHub / …). Frei editierbar in der App (Tab „Regeln").
 */
export const DEFAULT_RULES: CategorizeRule[] = [
  { id: 'r-github', pattern: 'github.com', kind: 'domain', categories: ['GitHub'], enabled: true },
  { id: 'r-gitlab', pattern: 'gitlab.com', kind: 'domain', categories: ['Entwicklung'], enabled: true },
  { id: 'r-stackoverflow', pattern: 'stackoverflow.com', kind: 'domain', categories: ['Entwicklung'], enabled: true },
  { id: 'r-npm', pattern: 'npmjs.com', kind: 'domain', categories: ['Entwicklung'], enabled: true },
  { id: 'r-mdn', pattern: 'developer.mozilla.org', kind: 'domain', categories: ['Entwicklung'], enabled: true },
  { id: 'r-docker', pattern: 'docker', kind: 'domain', categories: ['Docker', 'Entwicklung'], enabled: true },
  { id: 'r-huggingface', pattern: 'huggingface.co', kind: 'domain', categories: ['KI', 'KI-Modelle'], enabled: true },
  { id: 'r-openai', pattern: 'openai.com', kind: 'domain', categories: ['KI'], enabled: true },
  { id: 'r-chatgpt', pattern: 'chatgpt.com', kind: 'domain', categories: ['KI'], enabled: true },
  { id: 'r-anthropic', pattern: 'anthropic.com', kind: 'domain', categories: ['KI'], enabled: true },
  { id: 'r-kimi', pattern: 'moonshot', kind: 'domain', categories: ['KI'], enabled: true },
  { id: 'r-youtube', pattern: 'youtube.com', kind: 'domain', categories: ['Video'], enabled: true },
  { id: 'r-wikipedia', pattern: 'wikipedia.org', kind: 'domain', categories: ['Nachschlagewerke'], enabled: true },
  { id: 'r-linkdb-promptbase', pattern: 'promptbase.com', kind: 'domain', categories: ['Link-Datenbanken', 'KI'], enabled: true },
  { id: 'r-linkdb-freestuff', pattern: 'freestuff.dev', kind: 'domain', categories: ['Link-Datenbanken'], enabled: true },
  { id: 'r-linkdb-freefordev', pattern: 'free-for.dev', kind: 'domain', categories: ['Link-Datenbanken'], enabled: true },
  { id: 'r-linkdb-awesome', pattern: 'awesome', kind: 'keyword', categories: ['Link-Datenbanken', 'Entwicklung'], enabled: true },
  { id: 'r-kw-agent', pattern: 'agent', kind: 'keyword', categories: ['KI', 'KI-Agenten-Tools'], enabled: true },
  { id: 'r-kw-llm', pattern: 'llm', kind: 'keyword', categories: ['KI', 'KI-Agenten-Tools'], enabled: true },
  { id: 'r-kw-gpt', pattern: 'gpt', kind: 'keyword', categories: ['KI', 'KI-Agenten-Tools'], enabled: true },
  { id: 'r-kw-prompt', pattern: 'prompt', kind: 'keyword', categories: ['KI', 'KI-Agenten-Tools'], enabled: true },
  { id: 'r-kw-hermes', pattern: 'hermes', kind: 'keyword', categories: ['KI', 'KI-Agenten-Tools', 'KI — Hermes Agent — Erweiterungen'], enabled: true },
  { id: 'r-kw-skill', pattern: 'skill', kind: 'keyword', categories: ['KI — Hermes Agent — Erweiterungen'], enabled: true },
  { id: 'r-kw-docker', pattern: 'docker', kind: 'keyword', categories: ['Docker'], enabled: true },
  { id: 'r-kw-llc', pattern: 'llc', kind: 'keyword', categories: ['Business & LLC'], enabled: true },
  { id: 'r-kw-banking', pattern: 'banking', kind: 'keyword', categories: ['Business & LLC', 'Banking'], enabled: true },
  { id: 'r-kw-steuer', pattern: 'steuer', kind: 'keyword', categories: ['Business & LLC', 'Steuern'], enabled: true },
];

/** Wurzelkategorien, die von Anfang an existieren (Oberkategorien zum „Entlanghangeln"). */
export const SEED_CATEGORY_NAMES = [
  'KI',
  'KI-Agenten-Tools',
  'KI — Hermes Agent — Erweiterungen',
  'KI-Modelle',
  'GitHub',
  'Entwicklung',
  'Docker',
  'Business & LLC',
  'Banking',
  'Steuern',
  'Link-Datenbanken',
  'Video',
  'Nachschlagewerke',
  'Sonstige',
];

/** Verschachtelte Kategorie-Hierarchie (Kind -> übergeordnete Kategorie). */
export const SEED_CATEGORY_PARENTS: Record<string, string> = {
  'KI-Agenten-Tools': 'KI',
  'KI — Hermes Agent — Erweiterungen': 'KI-Agenten-Tools',
  'KI-Modelle': 'KI',
  GitHub: 'Entwicklung',
  Docker: 'Entwicklung',
  Banking: 'Business & LLC',
  Steuern: 'Business & LLC',
};

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSeedState(): AppState {
  const categories = SEED_CATEGORY_NAMES.map((name) => {
    const parentName = SEED_CATEGORY_PARENTS[name];
    const parent = parentName ? SEED_CATEGORY_NAMES.indexOf(parentName) : -1;
    return {
      id: `cat-${name}`,
      name,
      parentId: parent >= 0 ? `cat-${SEED_CATEGORY_NAMES[parent]}` : null,
      source: 'seed' as const,
    };
  });
  return { version: 1, bookmarks: [], categories, rules: DEFAULT_RULES };
}
