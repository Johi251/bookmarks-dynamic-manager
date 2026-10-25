"use strict";
(() => {
  // src/categorizer.ts
  function categorize(url, title, folderPath, rules) {
    let host = "";
    let pathAndTitle = "";
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      host = u.hostname.toLowerCase().replace(/^www\./, "");
      pathAndTitle = `${u.pathname} ${u.search} ${title}`.toLowerCase();
    } catch {
      pathAndTitle = `${url} ${title}`.toLowerCase();
    }
    const names = [];
    const matched = [];
    for (const rule of rules) {
      if (!rule.enabled || !rule.pattern) continue;
      const p = rule.pattern.toLowerCase();
      const hit = rule.kind === "domain" ? host.includes(p) : `${host} ${pathAndTitle}`.includes(p);
      if (hit) {
        matched.push(rule.id);
        for (const name of rule.categories) {
          if (name && !names.includes(name)) names.push(name);
        }
      }
    }
    for (const folder of folderPath.slice(0, 2)) {
      if (folder && !names.includes(folder)) names.push(folder);
    }
    if (names.length === 0 && host) {
      names.push(host);
    }
    if (names.length === 0) {
      names.push("Sonstige");
    }
    return { categories: names, matchedRuleIds: matched };
  }

  // src/rules.ts
  var DEFAULT_RULES = [
    { id: "r-github", pattern: "github.com", kind: "domain", categories: ["GitHub"], enabled: true },
    { id: "r-gitlab", pattern: "gitlab.com", kind: "domain", categories: ["Entwicklung"], enabled: true },
    { id: "r-stackoverflow", pattern: "stackoverflow.com", kind: "domain", categories: ["Entwicklung"], enabled: true },
    { id: "r-npm", pattern: "npmjs.com", kind: "domain", categories: ["Entwicklung"], enabled: true },
    { id: "r-mdn", pattern: "developer.mozilla.org", kind: "domain", categories: ["Entwicklung"], enabled: true },
    { id: "r-docker", pattern: "docker", kind: "domain", categories: ["Docker", "Entwicklung"], enabled: true },
    { id: "r-huggingface", pattern: "huggingface.co", kind: "domain", categories: ["KI", "KI-Modelle"], enabled: true },
    { id: "r-openai", pattern: "openai.com", kind: "domain", categories: ["KI"], enabled: true },
    { id: "r-chatgpt", pattern: "chatgpt.com", kind: "domain", categories: ["KI"], enabled: true },
    { id: "r-anthropic", pattern: "anthropic.com", kind: "domain", categories: ["KI"], enabled: true },
    { id: "r-kimi", pattern: "moonshot", kind: "domain", categories: ["KI"], enabled: true },
    { id: "r-youtube", pattern: "youtube.com", kind: "domain", categories: ["Video"], enabled: true },
    { id: "r-wikipedia", pattern: "wikipedia.org", kind: "domain", categories: ["Nachschlagewerke"], enabled: true },
    { id: "r-linkdb-promptbase", pattern: "promptbase.com", kind: "domain", categories: ["Link-Datenbanken", "KI"], enabled: true },
    { id: "r-linkdb-freestuff", pattern: "freestuff.dev", kind: "domain", categories: ["Link-Datenbanken"], enabled: true },
    { id: "r-linkdb-freefordev", pattern: "free-for.dev", kind: "domain", categories: ["Link-Datenbanken"], enabled: true },
    { id: "r-linkdb-awesome", pattern: "awesome", kind: "keyword", categories: ["Link-Datenbanken", "Entwicklung"], enabled: true },
    { id: "r-kw-agent", pattern: "agent", kind: "keyword", categories: ["KI", "KI-Agenten-Tools"], enabled: true },
    { id: "r-kw-llm", pattern: "llm", kind: "keyword", categories: ["KI", "KI-Agenten-Tools"], enabled: true },
    { id: "r-kw-gpt", pattern: "gpt", kind: "keyword", categories: ["KI", "KI-Agenten-Tools"], enabled: true },
    { id: "r-kw-prompt", pattern: "prompt", kind: "keyword", categories: ["KI", "KI-Agenten-Tools"], enabled: true },
    { id: "r-kw-hermes", pattern: "hermes", kind: "keyword", categories: ["KI", "KI-Agenten-Tools", "KI \u2014 Hermes Agent \u2014 Erweiterungen"], enabled: true },
    { id: "r-kw-skill", pattern: "skill", kind: "keyword", categories: ["KI \u2014 Hermes Agent \u2014 Erweiterungen"], enabled: true },
    { id: "r-kw-docker", pattern: "docker", kind: "keyword", categories: ["Docker"], enabled: true },
    { id: "r-kw-llc", pattern: "llc", kind: "keyword", categories: ["Business & LLC"], enabled: true },
    { id: "r-kw-banking", pattern: "banking", kind: "keyword", categories: ["Business & LLC", "Banking"], enabled: true },
    { id: "r-kw-steuer", pattern: "steuer", kind: "keyword", categories: ["Business & LLC", "Steuern"], enabled: true }
  ];
  var SEED_CATEGORY_NAMES = [
    "KI",
    "KI-Agenten-Tools",
    "KI \u2014 Hermes Agent \u2014 Erweiterungen",
    "KI-Modelle",
    "GitHub",
    "Entwicklung",
    "Docker",
    "Business & LLC",
    "Banking",
    "Steuern",
    "Link-Datenbanken",
    "Video",
    "Nachschlagewerke",
    "Sonstige"
  ];
  var SEED_CATEGORY_PARENTS = {
    "KI-Agenten-Tools": "KI",
    "KI \u2014 Hermes Agent \u2014 Erweiterungen": "KI-Agenten-Tools",
    "KI-Modelle": "KI",
    GitHub: "Entwicklung",
    Docker: "Entwicklung",
    Banking: "Business & LLC",
    Steuern: "Business & LLC"
  };
  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function createSeedState() {
    const categories = SEED_CATEGORY_NAMES.map((name) => {
      const parentName = SEED_CATEGORY_PARENTS[name];
      const parent = parentName ? SEED_CATEGORY_NAMES.indexOf(parentName) : -1;
      return {
        id: `cat-${name}`,
        name,
        parentId: parent >= 0 ? `cat-${SEED_CATEGORY_NAMES[parent]}` : null,
        source: "seed"
      };
    });
    return {
      version: 2,
      bookmarks: [],
      categories,
      rules: DEFAULT_RULES,
      glossary: [],
      dynamicGroups: [],
      settings: {
        favorites: [],
        startMinimized: false,
        aiProvider: "local",
        aiEndpoint: "",
        aiModel: ""
      }
    };
  }

  // src/ai/engine.ts
  var STOPWORDS = /* @__PURE__ */ new Set([
    // Deutsch
    "und",
    "oder",
    "der",
    "die",
    "das",
    "den",
    "dem",
    "des",
    "ein",
    "eine",
    "einer",
    "eines",
    "einem",
    "einen",
    "ist",
    "sind",
    "war",
    "waren",
    "wird",
    "werden",
    "wurde",
    "wurden",
    "f\xFCr",
    "mit",
    "von",
    "vom",
    "zum",
    "zur",
    "auf",
    "aus",
    "bei",
    "nach",
    "\xFCber",
    "unter",
    "vor",
    "durch",
    "gegen",
    "ohne",
    "um",
    "an",
    "am",
    "im",
    "in",
    "nicht",
    "auch",
    "als",
    "wie",
    "wenn",
    "dann",
    "noch",
    "nur",
    "schon",
    "sehr",
    "mehr",
    "kann",
    "muss",
    "seite",
    "seiten",
    "website",
    "webseite",
    "homepage",
    "startseite",
    "artikel",
    "beitrag",
    "blog",
    "news",
    "neue",
    "neuer",
    "neues",
    "alle",
    "aller",
    "alles",
    "hier",
    "dort",
    "diese",
    "dieser",
    "dieses",
    "mein",
    "meine",
    "dein",
    "deine",
    "sein",
    "ihre",
    "ihren",
    "unser",
    "unsere",
    "euer",
    "eure",
    "man",
    "wir",
    "ihr",
    "sie",
    "er",
    "es",
    "sich",
    "ihm",
    "ihn",
    "uns",
    "euch",
    " dich",
    // Englisch
    "the",
    "and",
    "or",
    "for",
    "with",
    "from",
    "to",
    "of",
    "in",
    "on",
    "at",
    "by",
    "as",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "should",
    "could",
    "can",
    "may",
    "might",
    "must",
    "shall",
    "not",
    "no",
    "but",
    "if",
    "then",
    "else",
    "when",
    "while",
    "this",
    "that",
    "these",
    "those",
    "it",
    "its",
    "his",
    "her",
    "their",
    "our",
    "your",
    "my",
    "we",
    "you",
    "they",
    "he",
    "she",
    "them",
    "him",
    "us",
    "all",
    "any",
    "both",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "only",
    "own",
    "same",
    "than",
    "too",
    "very",
    "just",
    "now",
    "new",
    "old",
    "free",
    "best",
    "top",
    "official",
    "home",
    "page",
    "site",
    "website",
    "welcome",
    "index",
    "docs",
    "doc",
    "wiki",
    "guide",
    "how",
    "what",
    "why",
    "who",
    "which",
    "where",
    "get",
    "got",
    "get",
    "make",
    "made",
    "use",
    "using",
    "used",
    // URL-Technik
    "http",
    "https",
    "www",
    "com",
    "de",
    "net",
    "org",
    "io",
    "html",
    "htm",
    "php",
    "asp",
    "index",
    "ref",
    "utm",
    "source",
    "medium",
    "campaign",
    "clid",
    "fbcl",
    "gcl",
    "en",
    "us",
    "p",
    "s",
    "v",
    "id"
  ]);
  function tokenize(text) {
    const normalized = text.replace(/[ÄÖÜ]/g, "A").replace(/[äöü]/g, "a").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
    return normalized.split(/[^a-z0-9]+/).map((t) => t.trim()).filter((t) => t.length >= 3 && t.length <= 24 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
  }
  function urlParts(url) {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      return { host: u.hostname.toLowerCase().replace(/^www\./, ""), path: `${u.pathname} ${u.search}`.toLowerCase() };
    } catch {
      return { host: "", path: "" };
    }
  }
  var norm = (s) => s.toLowerCase().trim();
  function includesTerm(haystack, term) {
    const t = norm(term);
    if (!t) return false;
    return haystack.includes(t);
  }
  function analyzeBookmark(url, title, existingTags, glossary) {
    const { host, path } = urlParts(url);
    const haystack = `${title} ${host} ${path}`.toLowerCase();
    const tags = [];
    const categories = [];
    const seen = new Set(existingTags.map(norm));
    const push = (tag) => {
      const t = norm(tag).replace(/\s+/g, "-");
      if (t && !seen.has(t) && !tags.includes(t)) {
        seen.add(t);
        tags.push(t);
      }
    };
    for (const entry of glossary) {
      if (!entry.term) continue;
      if (includesTerm(haystack, entry.term)) {
        push(entry.term);
        for (const rel of entry.related) push(rel);
        if (!categories.includes(entry.term)) categories.push(entry.term);
      } else {
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
    const titleTokens = tokenize(title);
    for (const t of titleTokens.slice(0, 3)) push(t);
    const hostCore = host.split(".")[0];
    if (hostCore && hostCore.length >= 4 && hostCore !== "localhost") push(hostCore);
    const unique = tags.filter((t) => !tags.some((other) => other !== t && other.length > t.length && other.includes(t)));
    return { tags: unique.slice(0, 8), categories };
  }

  // src/applyBookmark.ts
  function ensureCategory(state, name, source = "auto") {
    const exists = state.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) return state;
    return { ...state, categories: [...state.categories, { id: uid("cat"), name, parentId: null, source }] };
  }
  function mapNamesToIds(names, state) {
    let s = state;
    const ids = [];
    for (const name of names) {
      s = ensureCategory(s, name);
      const cat = s.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (!ids.includes(cat.id)) ids.push(cat.id);
    }
    return { state: s, ids };
  }
  function addBookmarkToState(state, input, opts = {}) {
    const url = input.url.startsWith("http") ? input.url : `https://${input.url}`;
    const dup = state.bookmarks.find((b) => b.url.toLowerCase().replace(/\/$/, "") === url.toLowerCase().replace(/\/$/, ""));
    if (dup) return null;
    const auto = categorize(url, input.title, input.folderPath ?? [], state.rules);
    let extraCategories = [];
    let extraTags = [];
    if (opts.enrich) {
      const analysis = analyzeBookmark(url, input.title, input.tags, state.glossary);
      extraTags = analysis.tags;
      extraCategories = analysis.categories;
    }
    const wantedCats = [...auto.categories, ...extraCategories.filter((c) => !auto.categories.includes(c))];
    const { state: s1, ids: autoIds } = mapNamesToIds(wantedCats, state);
    const categoryIds = [.../* @__PURE__ */ new Set([...input.categoryIds, ...autoIds])];
    const bookmark = {
      id: input.id ?? uid("bm"),
      title: input.title.trim() || url,
      url,
      added: input.added ?? Date.now(),
      tags: [.../* @__PURE__ */ new Set([...input.tags, ...extraTags])],
      categoryIds,
      pinned: input.pinned,
      note: input.note
    };
    return { state: { ...s1, bookmarks: [bookmark, ...s1.bookmarks] }, bookmark };
  }

  // src/storage.ts
  var STORAGE_KEY = "bdm-state-v1";
  var chromeApi = globalThis.chrome;
  var DEFAULT_SETTINGS = {
    favorites: [],
    startMinimized: false,
    aiProvider: "local",
    aiEndpoint: "",
    aiModel: ""
  };
  function migrateState(raw) {
    if (!raw || typeof raw !== "object") return null;
    const parsed = raw;
    if (!Array.isArray(parsed.bookmarks) || !Array.isArray(parsed.categories)) return null;
    return {
      version: 2,
      // Tag-Bereinigung (idempotent): normalisieren, deduplizieren, Teil-Tag-Varianten
      // entfernen („open"/„lyric" neben „openai"/„lyric-videos") — korrigiert auch
      // Bestände, die mit einer älteren Engine-Version erzeugt wurden.
      bookmarks: parsed.bookmarks.map(cleanBookmarkTags),
      categories: parsed.categories,
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
      glossary: Array.isArray(parsed.glossary) ? parsed.glossary : [],
      dynamicGroups: Array.isArray(parsed.dynamicGroups) ? parsed.dynamicGroups : [],
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings ?? {} }
    };
  }
  function cleanBookmarkTags(bm) {
    if (!Array.isArray(bm.tags) || bm.tags.length === 0) return bm;
    const seen = /* @__PURE__ */ new Set();
    const normalized = [];
    for (const raw of bm.tags) {
      const t = String(raw).toLowerCase().trim().replace(/\s+/g, "-");
      if (t && !seen.has(t)) {
        seen.add(t);
        normalized.push(t);
      }
    }
    const cleaned = normalized.filter((t) => !(t.length >= 4 && normalized.some((o) => o !== t && o.length > t.length && o.includes(t))));
    return cleaned.length === bm.tags.length && cleaned.every((t, i) => t === bm.tags[i]) ? bm : { ...bm, tags: cleaned };
  }
  function readLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = migrateState(JSON.parse(raw));
        if (parsed) return parsed;
      }
      return createSeedState();
    } catch {
      return createSeedState();
    }
  }
  async function loadStateAsync() {
    if (chromeApi?.storage?.local) {
      try {
        const bag = await chromeApi.storage.local.get(STORAGE_KEY);
        const parsed = migrateState(bag[STORAGE_KEY]);
        if (parsed) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          } catch {
          }
          return parsed;
        }
        return createSeedState();
      } catch {
        return readLocal();
      }
    }
    return readLocal();
  }
  function saveStateSync(state) {
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err) {
        console.error("Speichern fehlgeschlagen", err);
      }
    }
    if (chromeApi?.storage?.local) {
      void chromeApi.storage.local.set({ [STORAGE_KEY]: state }).catch(
        (err) => console.error("chrome.storage schreiben fehlgeschlagen", err)
      );
    }
    return true;
  }

  // extension/background.ts
  var MENU_ID = "bdm-save-page";
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: MENU_ID,
        title: "Zu Bookmarks Dynamic Manager hinzuf\xFCgen",
        contexts: ["page"]
      });
    });
  });
  async function saveCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? "";
    const title = tab?.title ?? "";
    if (!/^https?:\/\//i.test(url)) return { ok: false, reason: "invalid" };
    const state = await loadStateAsync();
    const result = addBookmarkToState(state, { title, url, tags: [], categoryIds: [], pinned: false });
    if (!result) return { ok: false, reason: "duplicate" };
    saveStateSync(result.state);
    const names = result.bookmark.categoryIds.map((id) => result.state.categories.find((c) => c.id === id)?.name ?? "").filter(Boolean);
    return { ok: true, categories: names };
  }
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID || !tab?.id) return;
    void (async () => {
      const outcome = await saveCurrentTab();
      await chrome.action.setBadgeText({ tabId: tab.id, text: outcome.ok ? "\u2713" : "!" });
      setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 1600);
    })();
  });
  chrome.commands?.onCommand.addListener((command) => {
    if (command === "save-page") void saveCurrentTab();
  });
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    void (async () => {
      switch (msg.type) {
        case "BDM_GET_CONTEXT": {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const url = tab?.url ?? "";
          if (!/^https?:\/\//i.test(url)) {
            sendResponse({ saved: false });
            return;
          }
          const state = await loadStateAsync();
          const saved = state.bookmarks.some((b) => b.url.toLowerCase().replace(/\/$/, "") === url.toLowerCase().replace(/\/$/, ""));
          sendResponse({ url, title: tab?.title, saved });
          return;
        }
        case "BDM_SAVE_CURRENT": {
          sendResponse(await saveCurrentTab());
          return;
        }
        case "BDM_RECENT": {
          const state = await loadStateAsync();
          const items = [...state.bookmarks].sort((a, b) => b.added - a.added).slice(0, 4).map((b) => ({ title: b.title, url: b.url }));
          sendResponse({ items });
          return;
        }
        default:
          sendResponse(null);
      }
    })();
    return true;
  });
})();
