import { describe, expect, test } from 'bun:test';
import { createSeedState } from '../src/rules';
import { migrateState, saveState } from '../src/storage';
import { exportCsv, importCsv, parseCsv, writeSnapshot, listSnapshots, ensureWeeklyBackup } from '../src/backup';
import { reducer, reducerWithHistory } from '../src/hooks/useBookmarks';
import { findDuplicates, sortBookmarks, computeStats } from '../src/stats';
import { clickerFromBridge, aklikUrl } from '../src/integrations';
import { refineRepo } from '../src/oneclicker';
import { addBookmarkToState } from '../src/applyBookmark';
import type { AppState, Bookmark } from '../src/types';

const bm = (id: string, extra: Partial<Bookmark> = {}): Bookmark => ({ id, title: id, url: `https://example.com/${id}`, added: 1, tags: [], categoryIds: [], pinned: false, ...extra });
const collection = (): AppState => ({ ...createSeedState(), categories: [
  { id: 'parent', name: 'Business', parentId: null, source: 'manual' },
  { id: 'child', name: 'Musik', parentId: 'parent', source: 'manual' },
], bookmarks: [bm('a', { categoryIds: ['parent'], note: 'Zeile 1\r\nZeile 2; "Text"', tags: ['one'], openedCount: 8 }), bm('b', { categoryIds: ['child'], pinned: true })],
glossary: [{ id: 'g', term: 'SMMA', definition: 'Social Media', related: ['Business'], createdAt: 1 }],
dynamicGroups: [{ id: 'd', name: '#top', terms: ['top'], createdAt: 1 }] });

describe('Import und Datenintegrität', () => {
  test('unterschiedliche Großschreibung im URL-Pfad bleibt getrennt', () => {
    const first = addBookmarkToState(createSeedState(), {title:'A',url:'https://example.com/A',tags:[],categoryIds:[],pinned:false})!;
    expect(addBookmarkToState(first.state, {title:'a',url:'https://example.com/a',tags:[],categoryIds:[],pinned:false})).not.toBeNull();
  });
  test('ungültige neue URLs gelangen nicht in den Zustand', () => {
    for (const url of ['javascript:alert(1)', 'ftp://example.com/', 'https://user:pass@example.com/']) expect(addBookmarkToState(createSeedState(), {title:'Bad',url,tags:[],categoryIds:[],pinned:false})).toBeNull();
  });
  test('CSV erhält Kategorien pro Link und das gesamte Modell', () => {
    const original = collection(), restored = importCsv(exportCsv(original));
    expect(restored.fullState).toBe(true);
    expect(restored.state).toEqual(original);
  });
  test('leerer CSV-Bestand erhält Glossar und Kategorien', () => {
    const original = { ...collection(), bookmarks: [] };
    expect(importCsv(exportCsv(original)).state).toEqual(original);
  });
  test('einfache CSV erstellt nur die Kategorien der jeweiligen Zeile', () => {
    const result = importCsv('Titel;URL;Kategorien\nA;https://example.com/a;Musik\nB;https://example.com/b;Business');
    expect(result.bookmarks.map((b) => b.categoryIds.map((id) => result.state.categories.find((c) => c.id === id)?.name))).toEqual([['Musik'], ['Business']]);
  });
  test('fehlende CSV-Zellen und defekte Anführungszeichen', () => {
    expect(importCsv('Titel;URL;Notiz\nA;https://example.com/a\nKaputt').skipped).toBe(1);
    expect(() => parseCsv('Titel;"offen', ';')).toThrow();
  });
  test.each([null, { bookmarks: [null], categories: [] }, { bookmarks: [bm('x', { url: 'javascript:alert(1)' })], categories: [] },
    { bookmarks: [bm('x', { categoryIds: ['missing'] })], categories: [] }, { ...collection(), version: 999 },
    { ...collection(), categories: [{id:'cycle', name:'X', parentId:'cycle', source:'manual'}] }
  ])('ungültige Daten werden vor Übernahme abgelehnt', (input) => expect(migrateState(input)).toBeNull());
  test('JSON-Merge erhält Eltern und gleichnamige Unterkategorien', () => {
    const state = collection();
    state.categories.push({ id: 'other', name: 'Musik', parentId: null, source: 'manual' });
    const merged = reducer({ ...createSeedState(), categories: [] }, { type: 'importState', imported: state, mode: 'merge' });
    const child = merged.categories.find((c) => c.name === 'Musik' && c.parentId)!;
    expect(merged.categories.find((c) => c.id === child.parentId)?.name).toBe('Business');
    expect(merged.categories.filter((c) => c.name === 'Musik')).toHaveLength(2);
    expect(migrateState(merged)).not.toBeNull();
  });
  test('Kategorie verwendet die vom Aufrufer erzeugte ID', () => {
    const category = {id:'chosen-id', name:'Neu', parentId:null, source:'manual' as const};
    expect(reducer(createSeedState(), {type:'addCategory', category}).categories).toContainEqual(category);
  });
});

describe('Historie, Mehrfachaktionen und Statistik', () => {
  test('Bulk-Pin lässt sich mit einem Schritt zurücknehmen und wiederholen', () => {
    const initial = collection(), h = reducerWithHistory({present:initial,past:[],future:[]}, {type:'pinMany',ids:['a','b'],pinned:true});
    const undo = reducerWithHistory(h, {type:'undo'});
    expect(undo.present).toEqual(initial);
    expect(reducerWithHistory(undo, {type:'redo'}).present.bookmarks.every((b) => b.pinned)).toBe(true);
  });
  test('Dubletten sind exakte URLs, nicht gleiche Titel oder verschiedene Ports/Pfade', () => {
    expect(findDuplicates([bm('a',{title:'Start'}),bm('b',{title:'Start'})])).toHaveLength(0);
    expect(findDuplicates([bm('a'), bm('b',{url:'https://example.com/a'})])).toHaveLength(1);
    expect(findDuplicates([bm('a'),bm('b',{url:'https://example.com/A'})])).toHaveLength(0);
  });
  test('Bereinigung erhält Tags, Notizen und Kategorien beider Dubletten', () => {
    const state = collection(); state.bookmarks[1].url = state.bookmarks[0].url; state.bookmarks[1].note = 'Andere Notiz';
    const merged = reducer(state, {type:'mergeDuplicates',groups:[['b','a']]});
    expect(merged.bookmarks).toHaveLength(1);
    expect(merged.bookmarks[0].categoryIds.sort()).toEqual(['child','parent']);
    expect(merged.bookmarks[0].note).toContain('Andere Notiz');
    expect(merged.bookmarks[0].note).toContain('Zeile 1');
  });
  test('Öffnungen und Sortierung funktionieren', () => {
    const state = reducer(collection(), {type:'markOpened',id:'b'});
    expect(computeStats(state).totalOpens).toBe(9);
    expect(sortBookmarks(state.bookmarks, 'recent')[0].id).toBe('b');
    expect(sortBookmarks(state.bookmarks, 'title').map((b) => b.id)).toEqual(['a','b']);
  });
  test('Rückgängig verwirft keine zwischenzeitlichen Öffnungszähler', () => {
    const h = reducerWithHistory({present:collection(),past:[],future:[]},{type:'pin',id:'a'});
    const opened = reducerWithHistory(h,{type:'markOpened',id:'a'});
    expect(reducerWithHistory(opened,{type:'undo'}).present.bookmarks.find((b)=>b.id==='a')?.openedCount).toBe(9);
  });
});

const values = new Map<string, string>();
const snapshots = new Map<string, unknown>();
let abortWrite = false;
globalThis.localStorage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } } as Storage;
globalThis.indexedDB = { open() {
  const request: any = {};
  queueMicrotask(() => {
    request.result = { close() {}, transaction() {
      const tx: any = {};
      tx.objectStore = () => ({
        put(value: unknown, key: string) { const req: any = {}; queueMicrotask(() => { if (abortWrite) { tx.error = new Error('Quota'); tx.onabort?.(); } else { snapshots.set(key,value); tx.oncomplete?.(); } }); return req; },
        getAll() { const req: any = {}; queueMicrotask(() => { req.result = [...snapshots.values()]; tx.oncomplete?.(); }); return req; },
        delete(key: string) { const req: any = {}; queueMicrotask(() => { snapshots.delete(key); tx.oncomplete?.(); }); return req; },
      }); return tx;
    } }; request.onsuccess?.();
  }); return request;
} } as unknown as IDBFactory;

describe('Sicheres Speichern und Backups', () => {
  test('Speicherlimit wird als Fehler gemeldet', async () => {
    const original = localStorage.setItem;
    localStorage.setItem = () => { throw new Error('Quota'); };
    try { await expect(saveState(collection())).rejects.toThrow('Quota'); }
    finally { localStorage.setItem = original; }
  });
  test('neunter Snapshot behält die acht neuesten', async () => {
    snapshots.clear();
    for (let i=1;i<=8;i++) snapshots.set(`2000-01-0${i}`,{date:`2000-01-0${i}`,createdAt:i,state:collection(),bookmarkCount:2});
    const saved = await writeSnapshot(collection()), all = await listSnapshots();
    expect(all).toHaveLength(8);
    expect(all[0].date).toBe(saved.date);
    expect(all.some((s) => s.date === '2000-01-01')).toBe(false);
  });
  test('Transaktionsabbruch gilt nicht als gesichert', async () => {
    values.delete('bdm-last-backup'); abortWrite = true;
    try { await expect(writeSnapshot(collection())).rejects.toThrow('Quota'); expect(values.has('bdm-last-backup')).toBe(false); }
    finally { abortWrite = false; }
  });
  test('leerer Erststart blockiert kein späteres Backup', async () => {
    values.delete('bdm-last-backup');
    expect(await ensureWeeklyBackup({...collection(),bookmarks:[]})).toBeNull();
    expect(values.has('bdm-last-backup')).toBe(false);
  });
});

describe('aKlik-Vertrauensgrenze', () => {
  test('fremdes oder unvollständiges Bridge-Ergebnis wird nicht bestätigt', () => {
    const info = {status:'checking',kind:'repo'} as const;
    expect(clickerFromBridge({schema:'bad'},'https://github.com/a/b',info)).toBeNull();
    const r = clickerFromBridge({schema:'aklik-deployer.status.v1',url:'https://github.com/a/b',state:'online',note:'X',launchUrl:'javascript:alert(1)',onlineReady:true},'https://github.com/a/b',info);
    expect(r?.verified).toBe(false);
  });
  test('Homepage bleibt ausdrücklich ungeprüfter Hinweis', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => Response.json({homepage:'https://docs.example.com/pricing'})) as typeof fetch;
    try {
      const r = await refineRepo({status:'checking',kind:'repo',repo:{owner:'a',name:'b',cloneUrl:'https://github.com/a/b.git'}},new AbortController().signal);
      expect(r.verified).toBe(false);
    } finally { globalThis.fetch = original; }
  });
  test('lokale Übergabe kann kein fremdes Programm einschleusen', () => {
    expect(new URL(aklikUrl('https://github.com/a/b')).origin).toBe('http://127.0.0.1:43110');
    expect(() => aklikUrl('javascript:alert(1)')).toThrow();
  });
});
