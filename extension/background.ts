/**
 * MV3-Background (Service Worker, IIFE-gebündelt): Kontextmenü, Tastenkürzel
 * und Speichern mit derselben Kategorisierungs-Logik wie die App.
 */
import { addBookmarkToState } from '../src/applyBookmark';
import { loadStateAsync, saveStateSync } from '../src/storage';

const MENU_ID = 'bdm-save-page';

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
}

async function saveCurrentTab(): Promise<SaveOutcome> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  const title = tab?.title ?? '';
  if (!/^https?:\/\//i.test(url)) return { ok: false, reason: 'invalid' };

  const state = await loadStateAsync();
  const result = addBookmarkToState(state, { title, url, tags: [], categoryIds: [], pinned: false });
  if (!result) return { ok: false, reason: 'duplicate' };

  saveStateSync(result.state);
  const names = result.bookmark.categoryIds
    .map((id) => result.state.categories.find((c) => c.id === id)?.name ?? '')
    .filter(Boolean);
  return { ok: true, categories: names };
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
