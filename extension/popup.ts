/**
 * Popup-Logik (ohne Framework): liest Kontext vom Background, speichert per
 * Nachricht und zeigt Auto-Kategorien sowie die letzten Einträge.
 */
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

interface SaveResponse {
  ok: boolean;
  reason?: 'duplicate' | 'invalid' | 'storage';
  categories?: string[];
}

async function send<T>(type: string): Promise<T> {
  const res = await chrome.runtime.sendMessage({ type });
  return res as T;
}

async function refresh() {
  const ctx = await send<{ url?: string; title?: string; saved: boolean }>('BDM_GET_CONTEXT');
  const title = $('pageTitle');
  const url = $('pageUrl');
  const save = $('save') as HTMLButtonElement;
  if (ctx.url) {
    title.textContent = ctx.title || ctx.url;
    url.textContent = ctx.url;
    save.disabled = ctx.saved;
    save.textContent = ctx.saved ? '✓ Bereits gespeichert' : '★ Diese Seite speichern';
  } else {
    title.textContent = 'Keine speicherbare Seite';
    url.textContent = '';
    save.disabled = true;
  }
  const recent = await send<{ items: { title: string; url: string }[] }>('BDM_RECENT');
  if (recent.items.length) {
    $('recent').hidden = false;
    $('recentList').innerHTML = '';
    for (const item of recent.items) {
      const a = document.createElement('a');
      a.href = item.url;
      a.textContent = item.title;
      a.title = item.url;
      a.target = '_blank';
      a.rel = 'noreferrer noopener';
      $('recentList').appendChild(a);
    }
  }
}

$('save').addEventListener('click', async () => {
  const save = $('save') as HTMLButtonElement;
  save.disabled = true;
  save.textContent = '⏳ Speichere …';
  let res: SaveResponse;
  try { res = await send<SaveResponse>('BDM_SAVE_CURRENT'); } catch { res = {ok:false, reason:'storage'}; }
  const out = $('result');
  const cats = $('cats');
  cats.innerHTML = '';
  if (res.ok) {
    out.innerHTML = '<div class="msg ok">✅ Gespeichert &amp; automatisch kategorisiert:</div>';
    for (const c of res.categories ?? []) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = c;
      cats.appendChild(chip);
    }
    save.textContent = '✓ Gespeichert';
  } else if (res.reason === 'storage') {
    out.textContent = 'Nicht gespeichert: Speicherfehler. Bitte den Manager öffnen.';
    save.textContent = 'Erneut versuchen'; save.disabled = false;
  } else if (res.reason === 'duplicate') {
    out.innerHTML = '<div class="msg warn">⚠️ Dieser Link ist bereits gespeichert.</div>';
    save.textContent = '✓ Bereits gespeichert';
  } else {
    out.innerHTML = '<div class="msg warn">⚠️ Diese Seite kann nicht gespeichert werden.</div>';
    save.textContent = '★ Diese Seite speichern';
    save.disabled = false;
  }
});

$('openManager').addEventListener('click', async (e) => {
  e.preventDefault();
  await chrome.tabs.create({ url: chrome.runtime.getURL('manager.html') });
});

void refresh().catch(() => { $('pageTitle').textContent = 'Manager öffnen: Daten konnten nicht geladen werden.'; });
