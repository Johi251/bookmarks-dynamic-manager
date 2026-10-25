/**
 * Logik-Tests für v1.3.0 (bun scripts/test-logic.ts).
 * Prüft die Kern-Features deterministisch nach: Cross-Verlinkung (SMMA-Beispiel),
 * dynamische Gruppen, KI-Engine, Migration v1/v2→v3, Shortcut-Parsing,
 * 1Clicker-Nutzungsweg-Klassifikation, CSV-Roundtrip, Backup-Fenster und
 * Favicon-Kette.
 */
import { migrateState } from '../src/storage';
import { crossLinksForBookmark, relatedTermsSharingAttributes } from '../src/crosslink';
import { termMatchesName, matchGlossary } from '../src/glossary';
import { bookmarkMatchesGroup, termsFromName, tagTermsForGroup } from '../src/groups';
import { analyzeBookmark, suggestGlossaryTerms } from '../src/ai/engine';
import { createSeedState } from '../src/rules';
import { parseShortcut, serializeShortcut, matchesShortcut, formatShortcut } from '../src/shortcut';
import { classifyClicker, deploySteps, needsCheck, parseRepo } from '../src/oneclicker';
import { detectDelimiter, exportCsv, importCsv } from '../src/backup';
import { isBackupDue } from '../src/backup';
import { avatarColorOf, faviconHostOf, faviconUrl, nextSource } from '../src/favicon';
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

console.log('T1 · Migration v1/v2 → v3');
{
  const v1 = {
    version: 1,
    bookmarks: [{ id: 'bm-1', title: 'A', url: 'https://a.com/', added: 1, tags: ['x'], categoryIds: ['cat-KI'], pinned: false }],
    categories: [{ id: 'cat-KI', name: 'KI', parentId: null, source: 'seed' }],
    rules: [],
  };
  const m = migrateState(v1);
  check('v1 wird zu v3 migriert', m !== null && m.version === 3);
  check('Bestand bleibt erhalten', m?.bookmarks.length === 1 && m?.categories.length === 1);
  check('Glossar/Gruppen/Settings initialisiert (v3-Defaults)', (m?.glossary.length ?? -1) === 0 && (m?.dynamicGroups.length ?? -1) === 0 && m?.settings.aiProvider === 'local' && m?.settings.clickerEnabled === true);
  const m2 = migrateState({ version: 2, bookmarks: [], categories: [], settings: { favorites: ['x'] } });
  check('v2 wird zu v3, Settings gemergt', m2?.version === 3 && m2?.settings.favorites[0] === 'x');
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

console.log('T7 · Seed-State v3');
{
  const s = createSeedState();
  check('Seed ist v3 mit allen Feldern', s.version === 3 && Array.isArray(s.glossary) && Array.isArray(s.dynamicGroups) && s.settings.startMinimized === false && s.settings.visionModel === 'glm-5.3-flash' && s.settings.autoBackup === true);
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

console.log('T9 · 1Clicker — Nutzungsweg-Klassifikation (statisch, offline)');
{
  // Repository → 🟠 Checking mit Repo-Koordinaten
  const repo = classifyClicker('https://github.com/louislam/uptime-kuma', 'Uptime Kuma', []);
  check('GitHub-Repo startet auf „checking" (orange blinkend)', repo?.status === 'checking' && repo.kind === 'repo');
  check('Repo-Koordinaten (owner/name/cloneUrl)', repo?.repo?.owner === 'louislam' && repo?.repo?.name === 'uptime-kuma' && repo?.repo?.cloneUrl === 'https://github.com/louislam/uptime-kuma.git');
  check('parseRepo ignoriert Nicht-Repo-Pfade', parseRepo('https://github.com/louislam') === null);
  check('parseRepo akzeptiert Codeberg', parseRepo('https://codeberg.org/foo/bar')?.host === 'codeberg.org');

  // Gehostete Web-App → 🟢 Online mit Launch-URL
  const web = classifyClicker('https://my-tool.vercel.app/', 'My Tool', []);
  check('vercel.app → „online" (grün) mit Launch-URL', web?.status === 'online' && web.kind === 'web' && web.launchUrl === 'https://my-tool.vercel.app/');
  const ghpages = classifyClicker('https://johi251.github.io/toolbox/', 'Toolbox', []);
  check('github.io → „online"', ghpages?.status === 'online');

  // Lokale Signale → 🔵 Lokal (Docker / portable / START-1CLICKER)
  const docker = classifyClicker('https://example.com/projects/docker-ui', 'Docker UI', []);
  check('Docker-Signal → „local" (blau) kind=docker', docker?.status === 'local' && docker.kind === 'docker');
  const portable = classifyClicker('https://example.com/downloads/tool-portable', 'Tool', []);
  check('Portable-Signal → „local" kind=portable', portable?.status === 'local' && portable.kind === 'portable');
  const repoDocker = classifyClicker('https://github.com/acme/ci-runner', 'CI Runner — docker compose deployment', []);
  check('Repo mit Docker-Signal → sofort „local"', repoDocker?.status === 'local' && repoDocker.kind === 'docker' && repoDocker.repo?.name === 'ci-runner');
  const cmd = classifyClicker('https://github.com/acme/starter', 'Projekt mit START-1CLICKER.cmd', []);
  check('START-1CLICKER.cmd-Signal schlägt Repo-Checking', cmd?.status === 'local' && cmd.kind === 'cmd');

  // Kein Software-Bezug → keine Badge
  check('Normaler Artikel → keine Badge (undefined)', classifyClicker('https://zeitung.example.com/wirtschaft', 'Nachrichten', []) === undefined);

  // Re-Check-Logik
  const bmChecking: Bookmark = { id: 'b1', title: 'T', url: 'https://github.com/a/b', added: 1, tags: [], categoryIds: [], pinned: false, clicker: { status: 'checking', kind: 'repo', repo: { owner: 'a', name: 'b', cloneUrl: 'https://github.com/a/b.git' } } };
  check('„checking" ohne checkedAt → Prüfung nötig', needsCheck(bmChecking) === true);
  const bmFreshOnline: Bookmark = { ...bmChecking, clicker: { status: 'online', kind: 'web', checkedAt: Date.now(), launchUrl: 'https://a.github.io/b/' } };
  check('Frisch geprüftes „online" → keine erneute Prüfung', needsCheck(bmFreshOnline) === false);

  // Bereitstellungs-Rezept (🔵 Badge-Klick)
  const bmDocker: Bookmark = { id: 'b2', title: 'DockGE', url: 'https://github.com/acme/dockge', added: 2, tags: [], categoryIds: [], pinned: false, clicker: repoDocker ?? undefined };
  const steps = deploySteps(bmDocker);
  check('Docker-Rezept: clone + compose/build + Repo-Link', steps.length === 3 && /git clone/.test(steps[0].command ?? '') && /docker/.test(steps[1].command ?? '') && Boolean(steps[2].link));
  const bmPortable: Bookmark = { id: 'b3', title: 'Kuma', url: 'https://github.com/acme/kuma', added: 3, tags: [], categoryIds: [], pinned: false, clicker: { status: 'local', kind: 'portable', checkedAt: 1, launchUrl: 'https://github.com/acme/kuma/releases/latest' } };
  const stepsP = deploySteps(bmPortable);
  check('Portable-Rezept: Release-Download-Link', stepsP.some((s) => /releases/.test(s.link ?? '')));
}

console.log('T10 · CSV-Export/-Import (Roundtrip, Sonderzeichen)');
{
  const state: AppState = {
    version: 3,
    bookmarks: [
      { id: '1', title: 'Tool „Pro"; 2026', url: 'https://example.com/a?x=1&y="2"', added: Date.UTC(2026, 9, 25), tags: ['ki', 'top-tools'], categoryIds: ['cat-KI'], pinned: true, note: 'Notiz; mit Semikolon', clicker: { status: 'online', kind: 'web', launchUrl: 'https://app.example.com/' } },
      { id: '2', title: 'Umlaute ÄÖÜ äöü ß', url: 'https://example.com/b', added: Date.UTC(2026, 9, 24), tags: [], categoryIds: [], pinned: false },
    ],
    categories: [{ id: 'cat-KI', name: 'KI', parentId: null, source: 'seed' }],
    rules: [], glossary: [], dynamicGroups: [],
    settings: createSeedState().settings,
  };
  const csv = exportCsv(state);
  check('CSV hat BOM + Kopfzeile', csv.startsWith('\uFEFF') && csv.slice(1).split('\r\n')[0].includes('Titel'));
  check('CSV-Trennzeichen-Erkennung (;)', detectDelimiter(csv.replace(/^\uFEFF/, '').split('\r\n')[0]) === ';');
  check('CSV-Trennzeichen-Erkennung (,)', detectDelimiter('Titel,URL,Tags') === ',');
  const back = importCsv(csv);
  check('Roundtrip: beide Lesezeichen zurück', back.bookmarks.length === 2 && back.skipped === 0);
  check('Roundtrip: Titel mit Anführungszeichen/Semikolon erhalten', back.bookmarks[0].title === 'Tool „Pro"; 2026');
  check('Roundtrip: URL mit Query erhalten', back.bookmarks[0].url === 'https://example.com/a?x=1&y="2"');
  check('Roundtrip: Tags + Kategorie-Namen zurück', back.bookmarks[0].tags.join(',') === 'ki,top-tools' && back.categoryNames.includes('KI'));
  check('Roundtrip: Angepinnt + Notiz + 1Clicker-Online-Status', back.bookmarks[0].pinned === true && back.bookmarks[0].note === 'Notiz; mit Semikolon' && back.bookmarks[0].clicker?.status === 'online' && back.bookmarks[0].clicker?.launchUrl === 'https://app.example.com/');
  check('Duplikat-Zeilen werden übersprungen', importCsv(csv + '\r\n' + csv.split('\r\n')[1]).skipped === 1);
  check('Ungültige Zeilen (keine URL) werden gezählt', importCsv('Titel;URL\r\nOhne;keine-url').skipped === 1);
}

console.log('T11 · Wöchentliche Auto-Sicherung (Fensterberechnung)');
{
  const now = Date.now();
  check('Nie gesichert → fällig', isBackupDue(null, now) === true);
  check('Vor 6 Tagen → nicht fällig', isBackupDue(now - 6 * 86_400_000, now) === false);
  check('Vor 7 Tagen → fällig', isBackupDue(now - 7 * 86_400_000, now) === true);
  check('Vor 8 Tagen → fällig', isBackupDue(now - 8 * 86_400_000, now) === true);
}

console.log('T12 · Favicon-Kette (Google S2 → Icon.horse → Buchstabe)');
{
  check('Google-S2-URL mit 64px', faviconUrl('google-s2', 'example.com') === 'https://www.google.com/s2/favicons?domain=example.com&sz=64');
  check('Icon.horse-URL', faviconUrl('icon-horse', 'example.com') === 'https://icon.horse/icon/example.com');
  check('Kette: s2 → horse → letter', nextSource('google-s2') === 'icon-horse' && nextSource('icon-horse') === 'letter');
  check('Buchstabe hat keine URL', faviconUrl('letter', 'example.com') === '');
  check('Host-Normalisierung entfernt www.', faviconHostOf('https://www.example.com/x') === 'example.com');
  check('Avatar-Farbe deterministisch + gedeckt', avatarColorOf('example.com') === avatarColorOf('example.com') && /^#[0-9a-f]{6}$/i.test(avatarColorOf('example.com')));
}

console.log('T13 · Migration v2→v3 hängt 1Clicker-Infos an');
{
  const m = migrateState({
    version: 2,
    bookmarks: [
      { id: '1', title: 'Repo', url: 'https://github.com/acme/tool', added: 1, tags: [], categoryIds: [], pinned: false },
      { id: '2', title: 'Web-App', url: 'https://tool.vercel.app/', added: 2, tags: [], categoryIds: [], pinned: false },
      { id: '3', title: 'Artikel', url: 'https://zeitung.example.com/artikel', added: 3, tags: [], categoryIds: [], pinned: false },
    ],
    categories: [],
  });
  check('v2-Repo erhält „checking"-Badge', m?.bookmarks[0].clicker?.status === 'checking');
  check('v2-Web-App erhält „online"-Badge', m?.bookmarks[1].clicker?.status === 'online');
  check('v2-Artikel bleibt ohne Badge', m?.bookmarks[2].clicker === undefined);
  // v3-Zustände werden nicht angetastet (idempotent):
  const v3 = migrateState({ version: 3, bookmarks: [{ id: '1', title: 'X', url: 'https://example.com/', added: 1, tags: [], categoryIds: [], pinned: false }], categories: [] });
  check('v3 ohne clicker wird ergänzt, v3 mit clicker bleibt', v3?.version === 3);
}

console.log(`\nErgebnis: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) {
  console.error('FEHLER:\n' + fails.join('\n'));
  process.exit(1);
}
