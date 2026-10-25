/**
 * Lokale KI-Analyse-Engine („Smart Import"): extrahiert aus URL und Titel
 * intelligente Meta-Tags, bezieht das Glossar ein und schlägt Kategorien vor.
 * Deterministisch, offline, kostenlos — und über den AiRouter nahtlos durch
 * eine eigene API ersetzbar.
 */
import type { Bookmark, GlossaryEntry } from '../types';

export interface SmartAnalysis {
  /** Vorgeschlagene Meta-Tags (kleingeschrieben, dedupliziert, ohne existing). */
  tags: string[];
  /** Zusätzliche Kategorienamen aus Glossar-Treffern (Regel-Engine läuft separat). */
  categories: string[];
}

const STOPWORDS = new Set([
  // Deutsch
  'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
  'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'wurde', 'wurden', 'für', 'mit', 'von', 'vom', 'zum', 'zur',
  'auf', 'aus', 'bei', 'nach', 'über', 'unter', 'vor', 'durch', 'gegen', 'ohne', 'um', 'an', 'am', 'im', 'in',
  'nicht', 'auch', 'als', 'wie', 'wenn', 'dann', 'noch', 'nur', 'schon', 'sehr', 'mehr', 'kann', 'muss',
  'seite', 'seiten', 'website', 'webseite', 'homepage', 'startseite', 'artikel', 'beitrag', 'blog', 'news',
  'neue', 'neuer', 'neues', 'alle', 'aller', 'alles', 'hier', 'dort', 'diese', 'dieser', 'dieses', 'mein',
  'meine', 'dein', 'deine', 'sein', 'ihre', 'ihren', 'unser', 'unsere', 'euer', 'eure', 'man', 'wir', 'ihr',
  'sie', 'er', 'es', 'sich', 'ihm', 'ihn', 'uns', 'euch', ' dich',
  // Englisch
  'the', 'and', 'or', 'for', 'with', 'from', 'to', 'of', 'in', 'on', 'at', 'by', 'as', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
  'can', 'may', 'might', 'must', 'shall', 'not', 'no', 'but', 'if', 'then', 'else', 'when', 'while', 'this',
  'that', 'these', 'those', 'it', 'its', 'his', 'her', 'their', 'our', 'your', 'my', 'we', 'you', 'they',
  'he', 'she', 'them', 'him', 'us', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'now', 'new', 'old', 'free', 'best', 'top',
  'official', 'home', 'page', 'site', 'website', 'welcome', 'index', 'docs', 'doc', 'wiki', 'guide', 'how',
  'what', 'why', 'who', 'which', 'where', 'get', 'got', 'get', 'make', 'made', 'use', 'using', 'used',
  // URL-Technik
  'http', 'https', 'www', 'com', 'de', 'net', 'org', 'io', 'html', 'htm', 'php', 'asp', 'index', 'ref',
  'utm', 'source', 'medium', 'campaign', 'clid', 'fbcl', 'gcl', 'en', 'us', 'p', 's', 'v', 'id',
]);

/** Zerlegt Text in bedeutungstragende Tokens (camelCase, Sonderzeichen, Umlaute). */
export function tokenize(text: string): string[] {
  const normalized = text
    .replace(/[ÄÖÜ]/g, 'A')
    .replace(/[äöü]/g, 'a')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase →Jay TX
    .toLowerCase();
  return normalized
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && t.length <= 24 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function urlParts(url: string): { host: string; path: string } {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return { host: u.hostname.toLowerCase().replace(/^www\./, ''), path: `${u.pathname} ${u.search}`.toLowerCase() };
  } catch {
    return { host: '', path: '' };
  }
}

const norm = (s: string): string => s.toLowerCase().trim();

function includesTerm(haystack: string, term: string): boolean {
  const t = norm(term);
  if (!t) return false;
  return haystack.includes(t);
}

/**
 * Analysiert einen Link: schlägt Meta-Tags vor (Titel-/URL-Token, Domain,
 * Glossar-Begriffe und deren verwandte Themen) und liefert Glossar-Kategorien.
 */
export function analyzeBookmark(url: string, title: string, existingTags: string[], glossary: GlossaryEntry[]): SmartAnalysis {
  const { host, path } = urlParts(url);
  const haystack = `${title} ${host} ${path}`.toLowerCase();
  const tags: string[] = [];
  const categories: string[] = [];
  const seen = new Set(existingTags.map(norm));

  const push = (tag: string) => {
    const t = norm(tag).replace(/\s+/g, '-');
    if (t && !seen.has(t) && !tags.includes(t)) {
      seen.add(t);
      tags.push(t);
    }
  };

  // 1) Glossar: Begriff im Titel/Host/Pfad → Begriff selbst + verwandte Themen als Tags.
  for (const entry of glossary) {
    if (!entry.term) continue;
    if (includesTerm(haystack, entry.term)) {
      push(entry.term);
      for (const rel of entry.related) push(rel);
      if (!categories.includes(entry.term)) categories.push(entry.term);
    } else {
      // Verwandter Begriff trifft → auch der Hauptbegriff ist relevant (Rückrichtung).
      for (const rel of entry.related) {
        if (includesTerm(haystack, rel)) {
          push(entry.term);
          push(rel);
          if (!categories.includes(entry.term)) categories.push(entry.term);
          break;
        }
      }
    }
  }

  // 2) Bedeutungstragende Titel-Token als Meta-Tags (max. 3, die stärksten zuerst).
  const titleTokens = tokenize(title);
  for (const t of titleTokens.slice(0, 3)) push(t);

  // 3) Domain-Kern als Tag (z. B. github.com → github), sofern noch nicht vorhanden.
  const hostCore = host.split('.')[0];
  if (hostCore && hostCore.length >= 4 && hostCore !== 'localhost') push(hostCore);

  // Redundanz raus: Teil-Tag-Varianten droppen („open"/„hugging" neben „openai"/„huggingface").
  const unique = tags.filter((t) => !tags.some((other) => other !== t && other.length > t.length && other.includes(t)));
  return { tags: unique.slice(0, 8), categories };
}

// ── Glossar-Lern-Empfehlungen ───────────────────────────────────────────────

export interface TermCandidate {
  term: string;
  count: number;
  examples: { title: string; url: string }[];
}

/**
 * Findet „unbekannte" markante Begriffe im Bestand — Kandidaten, die der Nutzer
 * im Glossar definieren sollte („Was genau meinst du damit?"). Markant heißt:
 * CamelCase, Großbuchstaben-Kürzel, Namen mit Ziffern (z. B. „ROFLnator.90").
 */
export function suggestGlossaryTerms(bookmarks: Bookmark[], glossary: GlossaryEntry[]): TermCandidate[] {
  const known = new Set<string>();
  for (const g of glossary) {
    known.add(norm(g.term));
    for (const r of g.related) known.add(norm(r));
  }

  const rawTokens = new Map<string, { display: string; count: number; camelCase: boolean; hasDigit: boolean; examples: { title: string; url: string }[] }>();

  for (const bm of bookmarks) {
    const { host } = urlParts(bm.url);
    const text = `${bm.title} ${host}`;
    // Namen/Kürzel/Ziffern-Begriffe: zusammenhängende Folgen aus Buchstaben, Ziffern, Punkt, Bindestrich.
    const tokens = text.match(/[A-Za-zÄÖÜäöü][A-Za-z0-9ÄÖÜäöü._-]{1,24}/g) ?? [];
    const perBookmark = new Set<string>();
    for (const raw of tokens) {
      const camelCase = /[a-zäöü][A-ZÄÖÜ]/.test(raw);
      const hasDigit = /\d/.test(raw);
      const isDistinctive =
        hasDigit || // Ziffern im Namen (ROFLnator.90, GPT-4)
        /^[A-ZÄÖÜ]{2,}$/.test(raw) || // Kürzel (SMMA, LLM)
        camelCase || // camelCase (JayTX, PromptBase)
        /^[A-ZÄÖÜ][a-zäöü]+$/.test(raw); // Eigenname-Kandidat
      if (!isDistinctive) continue;
      const term = raw.replace(/[._-]+$/, '');
      if (term.length < 3 || term.length > 24) continue;
      const key = norm(term);
      if (known.has(key) || STOPWORDS.has(key) || perBookmark.has(key)) continue;
      perBookmark.add(key);
      const entry = rawTokens.get(key) ?? { display: term, count: 0, camelCase, hasDigit, examples: [] };
      entry.count++;
      entry.camelCase = entry.camelCase || camelCase;
      if (entry.examples.length < 3) entry.examples.push({ title: bm.title, url: bm.url });
      rawTokens.set(key, entry);
    }
  }

  return [...rawTokens.entries()]
    .filter(([, v]) => v.display.length >= 3 && (v.count >= 2 || v.hasDigit || v.camelCase))
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12)
    .map(([, v]) => ({ term: v.display, count: v.count, examples: v.examples }));
}
