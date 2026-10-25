/**
 * Logik-Tests für v1.2.0 (bun scripts/test-logic.ts).
 * Prüft die neuen Kern-Features deterministisch nach: Cross-Verlinkung
 * (SMMA-Beispiel aus dem Auftrag), dynamische Gruppen, KI-Engine,
 * Migration v1→v2, Shortcut-Parsing.
 */
import { migrateState } from '../src/storage';
import { crossLinksForBookmark, relatedTermsSharingAttributes } from '../src/crosslink';
import { termMatchesName, matchGlossary } from '../src/glossary';
import { bookmarkMatchesGroup, termsFromName, tagTermsForGroup } from '../src/groups';
import { analyzeBookmark, suggestGlossaryTerms } from '../src/ai/engine';
import { createSeedState } from '../src/rules';
import { parseShortcut, serializeShortcut, matchesShortcut, formatShortcut } from '../src/shortcut';
import type { AppState, Bookmark, Category, DynamicGroup, GlossaryEntry } from '../src/types';

let pass = 0;
let fail = 0;
const fails: string[] = [];

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    fails.push(name + (detail ? ` — ${detail}` : ''));
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('T1 · Migration v1 → v2');
{
  const v1 = {
    version: 1,
    bookmarks: [{ id: 'bm-1', title: 'A', url: 'https://a.com/', added: 1, tags: ['x'], categoryIds: ['cat-KI'], pinned: false }],
    categories: [{ id: 'cat-KI', name: 'KI', parentId: null, source: 'seed' }],
    rules: [],
  };
  const m = migrateState(v1);
  check('v1 wird zu v2 migriert', m !== null && m.version === 2);
  check('Bestand bleibt erhalten', m?.bookmarks.length === 1 && m?.categories.length === 1);
  check('Glossar/Gruppen/Settings initialisiert', (m?.glossary.length ?? -1) === 0 && (m?.dynamicGroups.length ?? -1) === 0 && m?.settings.aiProvider === 'local');
  const m2 = migrateState({ version: 2, bookmarks: [], categories: [], settings: { favorites: ['x'] } });
  check('v2 bleibt v2, Settings gemergt', m2?.version === 2 && m2?.settings.favorites[0] === 'x');
  check('Ungültiges Objekt → null', migrateState({ nope: true }) === null);
}

console.log('T2 · Glossar-Matching');
{
  check('„SMMA" matcht „MEME SMMA" (Token-Teilmenge)', termMatchesName('SMMA', 'MEME SMMA'));
  check('„ki" matcht NICHT „kino" (keine Teilmenge)', !termMatchesName('ki', 'kino'));
  check('„JayTX" matcht „JayTX" exakt', termMatchesName('JayTX', 'JayTX'));
  const glossary: GlossaryEntry[] = [
    { id: 'g1', term: 'JayTX', definition: 'Musiker Business', related: ['SMMA', 'Lyric Videos', 'Musik-Vertrieb'], createdAt: 1 },
    { id: 'g2', term: 'ROFLnator.90', definition: 'MEME SMMA', related: ['MEME SMMA', 'Drive-Ordner', 'Auto-Posting'], createdAt: 2 },
    { id: 'g3', term: 'SMMA', definition: 'Social Media Marketing', related: [], createdAt: 3 },
  ];
  const hits = matchGlossary('JayTX — Lyric Videos & Musik-Vertrieb', glossary);
  check('Titel mit „JayTX" trifft Glossar-Eintrag JayTX', hits.some((h) => h.entry.term === 'JayTX'));
  const hits2 = matchGlossary('ROFLnator.90 — MEME SMMA Auto-Posting', glossary);
  check('Titel mit „ROFLnator.90" trifft eigenen Eintrag + SMMA', hits2.some((h) => h.entry.term === 'ROFLnator.90') && hits2.some((h) => h.entry.term === 'SMMA'));
}

console.log('T3 · Cross-Verlinkung (Auftrags-Beispiel JayTX ↔ ROFLnator.90 via SMMA)');
{
  const glossary: GlossaryEntry[] = [
    { id: 'g1', term: 'JayTX', definition: 'Musiker Business', related: ['SMMA', 'Lyric Videos', 'Musik-Vertrieb'], createdAt: 1 },
    { id: 'g2', term: 'ROFLnator.90', definition: 'MEME SMMA', related: ['MEME SMMA', 'Drive-Ordner', 'Auto-Posting'], createdAt: 2 },
  ];
  const shared = relatedTermsSharingAttributes('JayTX', glossary);
  check('JayTX teilt „SMMA" mit ROFLnator.90', shared.length === 1 && shared[0].otherTerm === 'ROFLnator.90' && shared[0].via.includes('SMMA'));

  const categories: Category[] = [
    { id: 'cat-jaytx', name: 'JayTX', parentId: null, source: 'manual' },
    { id: 'cat-rofl', name: 'ROFLnator.90', parentId: null, source: 'manual' },
    { id: 'cat-smma', name: 'SMMA', parentId: null, source: 'manual' },
  ];
  const state: AppState = { version: 2, bookmarks: [], categories, rules: [], glossary, dynamicGroups: [], settings: createSeedState().settings };
  const link: Bookmark = { id: 'bm-1', title: 'DistroKid Musik-Vertrieb', url: 'https://distrokid.example.com/', added: Date.now(), tags: [], categoryIds: ['cat-jaytx'], pinned: false };

  const links = crossLinksForBookmark(link, state);
  const rofl = links.find((l) => l.name === 'ROFLnator.90');
  check('Link in „JayTX" erscheint bei „ROFLnator.90" als verknüpft', Boolean(rofl));
  check('Verknüpfung nennt „SMMA" als gemeinsamen Begriff', rofl?.via.includes('SMMA') ?? false);
  const smma = links.find((l) => l.name === 'SMMA');
  check('Verwandtes Thema „SMMA" ist selbst Cross-Link-Ziel', Boolean(smma));
  check('Direkte Kategorie wird nicht als Cross-Link gelistet', !links.some((l) => l.id === 'cat-jaytx'));

  // Auch dynamische Gruppen sind Cross-Link-Ziele:
  const state2: AppState = { ...state, dynamicGroups: [{ id: 'grp-1', name: '#ROFLnator.90 MEME', terms: ['#meme'], createdAt: 1 }] };
  const links2 = crossLinksForBookmark(link, state2);
  check('Cross-Link auf dynamische Gruppe (Name enthält Begriff)', links2.some((l) => l.kind === 'group' && l.id === 'grp-1'));
}

console.log('T4 · Dynamische Gruppen (Hashtag-Manager)');
{
  check('termsFromName("#TOP KI") → [#top, ki]', JSON.stringify(termsFromName('#TOP KI')) === JSON.stringify(['#top', 'ki']));
  const cats: Category[] = [];
  const bmKi: Bookmark = { id: 'b1', title: 'Top KI Agenten Tools', url: 'https://ki.example.com/', added: 1, tags: ['top'], categoryIds: [], pinned: false };
  const bmKiTag: Bookmark = { id: 'b2', title: 'Agenten', url: 'https://x.example.com/', added: 1, tags: ['topki'], categoryIds: [], pinned: false };
  const bmKino: Bookmark = { id: 'b3', title: 'Kino-Programm', url: 'https://kino.example.com/', added: 1, tags: [], categoryIds: [], pinned: false };
  const gText: DynamicGroup = { id: 'g1', name: '#TOP KI', terms: termsFromName('#TOP KI'), createdAt: 1 };
  check('Text-Match: „Top KI Agenten Tools" gehört zu #TOP KI', bookmarkMatchesGroup(bmKi, gText, cats));
  check('Tag-Match: #topki über Hashtag-Gruppe #topki', bookmarkMatchesGroup(bmKiTag, { ...gText, terms: ['#topki'] }, cats));
  check('Wortgrenze: „ki" trifft NICHT „Kino"', !bookmarkMatchesGroup(bmKino, gText, cats));
  check('tagTermsForGroup liefert Hashtag-Tags', JSON.stringify(tagTermsForGroup({ id: 'g', name: '#TOP KI', terms: ['#top', 'ki'], createdAt: 1 })) === JSON.stringify(['top']));
}

console.log('T5 · KI-Engine (Smart Import)');
{
  const glossary: GlossaryEntry[] = [
    { id: 'g1', term: 'JayTX', definition: 'Musiker Business', related: ['SMMA', 'Musik-Vertrieb'], createdAt: 1 },
  ];
  const a = analyzeBookmark('https://jaytx.example.com/lyric-videos', 'JayTX Lyric Videos Tools', [], glossary);
  check('Glossar-Begriff „JayTX" wird Tag', a.tags.includes('jaytx'));
  check('Verwandtes Thema „SMMA" wird Tag', a.tags.includes('smma'));
  check('Kategorie-Vorschlag „JayTX"', a.categories.includes('JayTX'));
  const b = analyzeBookmark('https://github.com/example/awesome-llm-agents', 'Awesome LLM Agents', [], []);
  check('Titel-Token ohne Stopwörter als Meta-Tags (llm/agents/awesome)', b.tags.includes('llm') && b.tags.includes('agents'));
  const c = analyzeBookmark('https://openai.com/', 'OpenAI', ['openai'], []);
  check('Bestehende Tags werden nicht dupliziert', !c.tags.includes('openai') || c.tags.filter((t) => t === 'openai').length === 0);

  const bms: Bookmark[] = [
    { id: '1', title: 'JayTX — Lyric Videos', url: 'https://jaytx.example.com/', added: 1, tags: [], categoryIds: [], pinned: false },
    { id: '2', title: 'ROFLnator.90 MEME SMMA', url: 'https://roflnator.example.com/', added: 2, tags: [], categoryIds: [], pinned: false },
    { id: '3', title: 'SMMA Playbook', url: 'https://smma.example.com/', added: 3, tags: [], categoryIds: [], pinned: false },
  ];
  const cand = suggestGlossaryTerms(bms, []);
  check('Glossar-Kandidaten werden erkannt (JayTX/ROFLnator.90/SMMA)', cand.some((c2) => c2.term === 'JayTX') && cand.some((c2) => c2.term === 'ROFLnator.90') && cand.some((c2) => c2.term === 'SMMA'));
  const cand2 = suggestGlossaryTerms(bms, [{ id: 'g', term: 'JayTX', definition: '', related: [], createdAt: 1 }]);
  check('Bekannte Begriffe werden nicht erneut vorgeschlagen', !cand2.some((c2) => c2.term.toLowerCase() === 'jaytx'));
}

console.log('T6 · Shortcut (Standard Strg+F, konfigurierbar)');
{
  const sc = parseShortcut('ctrl+f');
  check('Parse ctrl+f', sc.ctrl && sc.key === 'f' && !sc.shift);
  check('Serialisierung Roundtrip', serializeShortcut(sc) === 'ctrl+f');
  check('Null → Standard Strg+F', parseShortcut(null).key === 'f');
  const ev = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: 'f' } as KeyboardEvent;
  const evShift = { ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, key: 'f' } as KeyboardEvent;
  check('matchesShortcut trifft Strg+F', matchesShortcut(ev, sc));
  check('matchesShortcut verwirft Strg+Shift+F', !matchesShortcut(evShift, sc));
  check('Formatierung „Strg + F"', formatShortcut(sc).includes('Strg') && formatShortcut(sc).includes('F'));
}

console.log('T7 · Seed-State v2');
{
  const s = createSeedState();
  check('Seed ist v2 mit allen Feldern', s.version === 2 && Array.isArray(s.glossary) && Array.isArray(s.dynamicGroups) && s.settings.startMinimized === false);
}

console.log('T8 · Tag-Bereinigung (Migration, idempotent)');
{
  const m = migrateState({
    version: 2,
    bookmarks: [
      { id: '1', title: 'OpenAI', url: 'https://openai.com/', added: 1, tags: ['open', 'OpenAI', 'openai'], categoryIds: [], pinned: false },
      { id: '2', title: 'JayTX', url: 'https://jaytx.example.com/', added: 2, tags: ['lyric', 'lyric videos', 'Lyric Videos', 'ki'], categoryIds: [], pinned: false },
    ],
    categories: [],
  });
  const bm1 = m?.bookmarks[0].tags ?? [];
  const bm2 = m?.bookmarks[1].tags ?? [];
  check('Teil-Tag „open" neben „openai" wird entfernt', bm1.join(',') === 'openai');
  check('Leerzeichen-Tags normalisiert + dedupliziert', bm2.includes('lyric-videos') && !bm2.includes('lyric videos'));
  check('Kurz-Tag „ki" (2 Zeichen) bleibt erhalten', bm2.includes('ki'));
  check('Teil-Tag „lyric" (4+) neben „lyric-videos" wird entfernt', !bm2.includes('lyric'));
}

console.log(`\nErgebnis: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) {
  console.error('FEHLER:\n' + fails.join('\n'));
  process.exit(1);
}
