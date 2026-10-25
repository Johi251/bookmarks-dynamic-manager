/**
 * MV3-Background (Service Worker, IIFE-gebündelt): Kontextmenü, Tastenkürzel
 * und Speichern mit derselben Kategorisierungs-Logik wie die App.
 *
 * v1.3.0 — Multimodale Vision-Erweiterung: Ist „Vision beim Speichern" in den
 * Einstellungen aktiv (und eine OpenAI-kompatible API konfiguriert), wird beim
 * Speichern ein Screenshot der sichtbaren Seite gezogen (activeTab), auf
 * Postergröße verkleinert und vom Vision-Modell (Standard GLM-5.3 Flash)
 * verschlagwortet — Tags/Kategorien landen direkt auf dem Lesezeichen.
 */
import { addBookmarkToState, mapNamesToIds } from '../src/applyBookmark';
import { loadStateAsync, saveStateSync } from '../src/storage';
import { analyzeScreenshot } from '../src/ai/vision';
import type { ClickerInfo } from '../src/types';
import { classifyClicker } from '../src/oneclicker';

const MENU_ID = 'bdm-save-page';
const SHOTS_KEY = 'bdm-shots-v1';
const SHOTS_MAX = 12;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Zu Bookmarks Dynamic Manager hinzufügen',
      contexts: ['page'],
    });
  });
});

interface SaveOutcome {
  ok: boolean;
  reason?: 'duplicate' | 'invalid';
  categories?: string[];
  visionTags?: string[];
  vision?: 'vision' | 'local' | 'off';
}

/** Verkleinert den Screenshot auf max. 640 px Breite (JPEG, Qualität 0.55). */
async function downscaleShot(dataUrl: string): Promise<string> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 640 / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.55 });
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(out);
    });
  } catch {
    return dataUrl;
  }
}

async function storeShot(bookmarkId: string, dataUrl: string): Promise<void> {
  try {
    const bag = (await chrome.storage.local.get(SHOTS_KEY)) as Record<string, unknown>;
    const shots = (bag[SHOTS_KEY] as Record<string, string> | undefined) ?? {};
    shots[bookmarkId] = dataUrl;
    // LRU-Kappung: nur die jüngsten SHOTS_MAX Screenshots behalten.
    const ids = Object.keys(shots);
    if (ids.length > SHOTS_MAX) {
      const state = await loadStateAsync();
      const order = new Map(state.bookmarks.map((b, i) => [b.id, i]));
      ids.sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity));
      for (const id of ids.slice(0, ids.length - SHOTS_MAX)) delete shots[id];
    }
    await chrome.storage.local.set({ [SHOTS_KEY]: shots });
  } catch {
    /* Screenshots sind optional */
  }
}

async function saveCurrentTab(): Promise<SaveOutcome> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  const title = tab?.title ?? '';
  if (!/^https?:\/\//i.test(url)) return { ok: false, reason: 'invalid' };

  const state = await loadStateAsync();
  const result = addBookmarkToState(state, { title, url, tags: [], categoryIds: [], pinned: false });
  if (!result) return { ok: false, reason: 'duplicate' };

  let nextState = result.state;
  let bookmark = result.bookmark;

  // 1Clicker: statische Nutzungsweg-Klassifikation direkt beim Speichern.
  const clicker = classifyClicker(url, title, []);
  if (clicker) {
    const info: ClickerInfo = clicker;
    bookmark = { ...bookmark, clicker: info };
    nextState = { ...nextState, bookmarks: nextState.bookmarks.map((b) => (b.id === bookmark.id ? bookmark : b)) };
  }

  // Vision: Screenshot ziehen + verschlagworten (optional, fehlertolerant).
  let vision: SaveOutcome['vision'] = 'off';
  let visionTags: string[] | undefined;
  if (state.settings.visionOnSave && state.settings.aiProvider === 'api' && state.settings.aiEndpoint) {
    try {
      const raw = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 70 });
      if (raw) {
        const shot = await downscaleShot(raw);
        await storeShot(bookmark.id, shot);
        const res = await analyzeScreenshot(
          shot,
          { url, title, existingTags: bookmark.tags },
          state.settings,
          state.glossary
        );
        vision = res.used;
        if (res.tags.length > 0) {
          visionTags = res.tags;
          const merged = [...new Set([...bookmark.tags, ...res.tags])];
          const { state: s2, ids } = mapNamesToIds(res.categories, nextState);
          bookmark = { ...bookmark, tags: merged, categoryIds: [...new Set([...bookmark.categoryIds, ...ids])] };
          nextState = {
            ...s2,
            bookmarks: s2.bookmarks.map((b) => (b.id === bookmark.id ? bookmark : b)),
          };
        }
      }
    } catch {
      /* Screenshot/Vision optional — Speichern darf daran nicht scheitern */
    }
  }

  saveStateSync(nextState);
  const names = bookmark.categoryIds
    .map((id) => nextState.categories.find((c) => c.id === id)?.name ?? '')
    .filter(Boolean);
  return { ok: true, categories: names, visionTags, vision };
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  void (async () => {
    const outcome = await saveCurrentTab();
    await chrome.action.setBadgeText({ tabId: tab.id, text: outcome.ok ? '✓' : '!' });
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: '' }), 1600);
  })();
});

chrome.commands?.onCommand.addListener((command: string) => {
  if (command === 'save-page') void saveCurrentTab();
});

chrome.runtime.onMessage.addListener((msg: { type: string }, _sender, sendResponse: (v: unknown) => void) => {
  void (async () => {
    switch (msg.type) {
      case 'BDM_GET_CONTEXT': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tab?.url ?? '';
        if (!/^https?:\/\//i.test(url)) {
          sendResponse({ saved: false });
          return;
        }
        const state = await loadStateAsync();
        const saved = state.bookmarks.some((b) => b.url.toLowerCase().replace(/\/$/, '') === url.toLowerCase().replace(/\/$/, ''));
        sendResponse({ url, title: tab?.title, saved });
        return;
      }
      case 'BDM_SAVE_CURRENT': {
        sendResponse(await saveCurrentTab());
        return;
      }
      case 'BDM_RECENT': {
        const state = await loadStateAsync();
        const items = [...state.bookmarks]
          .sort((a, b) => b.added - a.added)
          .slice(0, 4)
          .map((b) => ({ title: b.title, url: b.url }));
        sendResponse({ items });
        return;
      }
      default:
        sendResponse(null);
    }
  })();
  return true; // Antwort asynchron
});
