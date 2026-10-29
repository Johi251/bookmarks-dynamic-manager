"use strict";
(() => {
  // src/host.ts
  function urlKey(url) {
    try {
      return new URL(url).href.replace(/\/$/, "");
    } catch {
      return url;
    }
  }

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
      version: 3,
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
        aiModel: "",
        clickerEnabled: true,
        faviconsEnabled: true,
        visionOnSave: false,
        visionModel: "glm-5.3-flash",
        autoBackup: true
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

  // src/oneclicker.ts
  var CLICKER_RECHECK_MS = 14 * 864e5;
  var REPO_HOSTS = /* @__PURE__ */ new Set(["github.com", "gitlab.com", "codeberg.org", "sourceforge.net"]);
  var HOSTED_WEB_SUFFIXES = [
    "vercel.app",
    "netlify.app",
    "github.io",
    "pages.dev",
    "render.com",
    "railway.app",
    "huggingface.space",
    "streamlit.app",
    "replit.app",
    "fly.dev",
    "herokuapp.com",
    "web.app",
    "firebaseapp.com",
    "cloudflareworkers.com",
    "deno.dev",
    "glitch.me"
  ];
  var LOCAL_SIGNALS = [
    { pattern: /start-1clicker\.cmd/i, kind: "cmd", reason: "START-1CLICKER.cmd vorhanden" },
    { pattern: /\bdocker[- ]?(compose|file|image)?\b|\/docker\b/i, kind: "docker", reason: "Docker-Unterst\xFCtzung erkannt" },
    { pattern: /portable|standalone[- ]exe|\.exe\b|x64[- ]zip|win(?:dows)?[- ](?:portable|zip)/i, kind: "portable", reason: "Portable Windows-Assets erkannt" }
  ];
  function parseRepo(url) {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      if (!REPO_HOSTS.has(u.hostname.toLowerCase().replace(/^www\./, ""))) return null;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length < 2) return null;
      const name = parts[1].replace(/\.git$/, "");
      if (!/^[A-Za-z0-9_.-]+$/.test(parts[0]) || !/^[A-Za-z0-9_.-]+$/.test(name)) return null;
      return { owner: parts[0], name, cloneUrl: `https://${u.hostname}/${parts[0]}/${name}.git`, host: u.hostname.toLowerCase() };
    } catch {
      return null;
    }
  }
  function classifyClicker(url, title, tags = []) {
    let host = "";
    try {
      host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return void 0;
    }
    const haystack = `${title} ${url} ${tags.join(" ")}`;
    for (const sig of LOCAL_SIGNALS) {
      if (sig.pattern.test(haystack)) {
        const repo = parseRepo(url);
        return {
          status: "local",
          kind: sig.kind,
          reason: sig.reason,
          verified: false,
          repo: repo ? { owner: repo.owner, name: repo.name, cloneUrl: repo.cloneUrl } : void 0
        };
      }
    }
    if (HOSTED_WEB_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) {
      return { status: "online", kind: "web", launchUrl: url, reason: `Gehostete Webseite (${host}); Kosten und Funktion ungepr\xFCft`, verified: false };
    }
    if (REPO_HOSTS.has(host)) {
      const repo = parseRepo(url);
      if (repo) {
        return { status: "checking", kind: "repo", repo: { owner: repo.owner, name: repo.name, cloneUrl: repo.cloneUrl } };
      }
    }
    return void 0;
  }

  // src/storage.ts
  var STORAGE_KEY = "bdm-state-v1";
  var AI_KEY_STORAGE = "bdm-ai-key";
  var chromeApi = globalThis.chrome;
  var DEFAULT_SETTINGS = {
    favorites: [],
    startMinimized: false,
    aiProvider: "local",
    aiEndpoint: "",
    aiModel: "",
    clickerEnabled: true,
    faviconsEnabled: true,
    visionOnSave: false,
    visionModel: "glm-5.3-flash",
    autoBackup: true
  };
  function migrateState(raw) {
    if (!raw || typeof raw !== "object") return null;
    const parsed = raw;
    if (!Array.isArray(parsed.bookmarks) || !Array.isArray(parsed.categories)) return null;
    if (parsed.version !== void 0 && ![1, 2, 3].includes(parsed.version)) return null;
    if (!validStateData(parsed)) return null;
    const oldVersion = parsed.version ?? 1;
    return {
      version: 3,
      // Tag-Bereinigung (idempotent): normalisieren, deduplizieren, Teil-Tag-Varianten
      // entfernen („open"/„lyric" neben „openai"/„lyric-videos") — korrigiert auch
      // Bestände, die mit einer älteren Engine-Version erzeugt wurden.
      // Bei v2 → v3 zusätzlich: statische 1Clicker-Nutzungsweg-Klassifikation.
      bookmarks: parsed.bookmarks.map((b) => upgradeClicker(cleanBookmarkTags(b), oldVersion)),
      categories: parsed.categories,
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
      glossary: Array.isArray(parsed.glossary) ? parsed.glossary : [],
      dynamicGroups: Array.isArray(parsed.dynamicGroups) ? parsed.dynamicGroups : [],
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings ?? {} }
    };
  }
  var record = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  var strings = (v) => Array.isArray(v) && v.every((s) => typeof s === "string");
  var finite = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  function isWebUrl(v) {
    if (typeof v !== "string") return false;
    try {
      const u = new URL(v);
      return ["http:", "https:"].includes(u.protocol) && !!u.hostname && !u.username && !u.password;
    } catch {
      return false;
    }
  }
  function validStateData(s) {
    const cats = s.categories;
    if (!cats.every((c) => record(c) && typeof c.id === "string" && !!c.id && typeof c.name === "string" && (c.parentId === null || typeof c.parentId === "string") && ["import", "auto", "manual", "rule", "seed"].includes(String(c.source)))) return false;
    const parents = new Map(cats.map((c) => [c.id, c.parentId]));
    if (parents.size !== cats.length) return false;
    for (const [id, parent] of parents) {
      const seen = /* @__PURE__ */ new Set([id]);
      let cur = parent;
      while (cur !== null) {
        if (!parents.has(cur) || seen.has(cur)) return false;
        seen.add(cur);
        cur = parents.get(cur);
      }
    }
    const ids = /* @__PURE__ */ new Set();
    if (!s.bookmarks.every((b) => {
      if (!record(b) || typeof b.id !== "string" || !b.id || ids.has(b.id) || typeof b.title !== "string" || !isWebUrl(b.url) || !finite(b.added) || !strings(b.tags) || !strings(b.categoryIds) || b.categoryIds.some((id) => !parents.has(id)) || typeof b.pinned !== "boolean" || b.note !== void 0 && typeof b.note !== "string" || b.openedCount !== void 0 && !finite(b.openedCount) || b.lastOpenedAt !== void 0 && !finite(b.lastOpenedAt) || b.capturedAt !== void 0 && !finite(b.capturedAt) || b.source !== void 0 && b.source !== "copyNpaste") return false;
      ids.add(b.id);
      if (b.clicker !== void 0) {
        const c = b.clicker;
        if (!record(c) || !["checking", "online", "local", "none"].includes(String(c.status)) || !["repo", "web", "docker", "portable", "cmd"].includes(String(c.kind)) || c.launchUrl !== void 0 && !isWebUrl(c.launchUrl) || c.checkedAt !== void 0 && !finite(c.checkedAt) || c.reason !== void 0 && typeof c.reason !== "string" || c.verified !== void 0 && typeof c.verified !== "boolean" || c.repo !== void 0 && (!record(c.repo) || typeof c.repo.owner !== "string" || typeof c.repo.name !== "string" || !isWebUrl(c.repo.cloneUrl))) return false;
      }
      return true;
    })) return false;
    const arrays = [
      ["rules", (r) => ["domain", "keyword"].includes(String(r.kind)) && typeof r.pattern === "string" && strings(r.categories) && typeof r.enabled === "boolean"],
      ["glossary", (g) => typeof g.term === "string" && typeof g.definition === "string" && strings(g.related) && finite(g.createdAt)],
      ["dynamicGroups", (g) => typeof g.name === "string" && strings(g.terms) && finite(g.createdAt)]
    ];
    for (const [key, validate] of arrays) {
      if (s[key] === void 0) continue;
      const seen = /* @__PURE__ */ new Set();
      if (!Array.isArray(s[key]) || !s[key].every((x) => {
        if (!record(x) || typeof x.id !== "string" || !x.id || seen.has(x.id) || !validate(x)) return false;
        seen.add(x.id);
        return true;
      })) return false;
    }
    if (s.settings !== void 0) {
      if (!record(s.settings)) return false;
      for (const [key, value] of Object.entries(s.settings)) {
        if (key === "favorites" ? !strings(value) : key in DEFAULT_SETTINGS && typeof value !== typeof DEFAULT_SETTINGS[key]) return false;
      }
      if (s.settings.aiProvider !== void 0 && !["local", "api"].includes(String(s.settings.aiProvider))) return false;
    }
    return true;
  }
  function upgradeClicker(bm, oldVersion) {
    if (oldVersion >= 3 && bm.clicker !== void 0) return bm;
    const info = classifyClicker(bm.url, bm.title, bm.tags);
    return info ? { ...bm, clicker: info } : bm;
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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = migrateState(JSON.parse(raw));
    if (!parsed) throw new Error("Gespeicherte Daten sind ung\xFCltig. Der vorhandene Bestand wurde nicht \xFCberschrieben.");
    return parsed;
  }
  async function loadStateAsync() {
    if (chromeApi?.storage?.local) {
      const bag = await chromeApi.storage.local.get(STORAGE_KEY);
      if (bag[STORAGE_KEY] === void 0) return createSeedState();
      const parsed = migrateState(bag[STORAGE_KEY]);
      if (parsed) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch {
        }
        return parsed;
      }
      throw new Error("Gespeicherte Add-on-Daten sind ung\xFCltig. Bitte eine g\xFCltige JSON-Sicherung importieren.");
    }
    return readLocal();
  }
  async function saveState(state) {
    if (!migrateState(state)) throw new Error("Ung\xFCltiger Zustand wurde nicht gespeichert.");
    if (chromeApi?.storage?.local) {
      await chromeApi.storage.local.set({ [STORAGE_KEY]: state });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }
  async function getAiApiKey() {
    if (chromeApi?.storage?.local) {
      const bag = await chromeApi.storage.local.get(AI_KEY_STORAGE);
      if (typeof bag[AI_KEY_STORAGE] === "string") return bag[AI_KEY_STORAGE];
      const old = typeof localStorage !== "undefined" ? localStorage.getItem(AI_KEY_STORAGE) : null;
      if (old) await chromeApi.storage.local.set({ [AI_KEY_STORAGE]: old });
      return old ?? "";
    }
    return localStorage.getItem(AI_KEY_STORAGE) ?? "";
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
    const url = /^https?:\/\//i.test(input.url.trim()) ? input.url.trim() : `https://${input.url.trim()}`;
    if (!isWebUrl(url) || /^[a-z][a-z\d+.-]*:\/\//i.test(input.url) && !/^https?:\/\//i.test(input.url)) return null;
    const dup = state.bookmarks.find((b) => urlKey(b.url) === urlKey(url));
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
    const clicker = classifyClicker(url, input.title, input.tags);
    const bookmark = {
      id: input.id ?? uid("bm"),
      title: input.title.trim() || url,
      url,
      added: input.added ?? Date.now(),
      tags: [.../* @__PURE__ */ new Set([...input.tags, ...extraTags])],
      categoryIds,
      pinned: input.pinned,
      note: input.note,
      clicker
    };
    return { state: { ...s1, bookmarks: [bookmark, ...s1.bookmarks] }, bookmark };
  }

  // src/ai/vision.ts
  function toStringArray(value) {
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
  }
  async function analyzeScreenshot(imageDataUrl, bookmark, settings, glossary, signal) {
    const local = () => ({
      ...analyzeBookmark(bookmark.url, bookmark.title, bookmark.existingTags, glossary),
      used: "local"
    });
    const endpoint = settings.aiEndpoint.trim().replace(/\/+$/, "");
    const model = (settings.visionModel || "glm-5.3-flash").trim();
    const key = await getAiApiKey();
    if (settings.aiProvider !== "api" || !endpoint || !key || !imageDataUrl.startsWith("data:image/")) {
      return local();
    }
    const glossaryContext = glossary.length ? glossary.map((g) => `${g.term} = ${g.definition} [verwandt: ${g.related.join(", ")}]`).join("\n") : "(noch leer)";
    const payload = {
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: 'Du analysierst Screenshots von Webseiten f\xFCr eine Lesezeichen-Verwaltung. Beschreibe kurz das, was auf dem Screenshot ZU SEHEN ist (Art der Anwendung, Oberfl\xE4che, erkennbare Themen), und leite daraus Schlagw\xF6rter und passende Kategorien ab. Nutze das Glossar des Nutzers, wenn ein Begriff passt. Antworte ausschlie\xDFlich als JSON: {"tags":["..."],"categories":["..."],"visual":"<ein Satz>"} (tags: max. 5, kleingeschrieben).'
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Glossar:
${glossaryContext}

Lesezeichen: ${bookmark.title}
${bookmark.url}

Analysiere den Screenshot.`
            },
            { type: "image_url", image_url: { url: imageDataUrl } }
          ]
        }
      ]
    };
    const controller = new AbortController();
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    const timer = setTimeout(() => controller.abort(), 45e3);
    try {
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`Vision-API antwortete mit HTTP ${res.status}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      const tags = toStringArray(parsed.tags).map((t) => t.toLowerCase().replace(/\s+/g, "-")).slice(0, 5);
      const categories = toStringArray(parsed.categories).slice(0, 4);
      const visual = typeof parsed.visual === "string" ? parsed.visual : void 0;
      const fallback = analyzeBookmark(bookmark.url, bookmark.title, [...bookmark.existingTags, ...tags], glossary);
      return {
        tags: [.../* @__PURE__ */ new Set([...tags, ...fallback.tags])].slice(0, 8),
        categories: [.../* @__PURE__ */ new Set([...categories, ...fallback.categories])],
        used: "vision",
        visualSummary: visual
      };
    } catch (err) {
      return {
        ...local(),
        fallbackReason: String(err instanceof Error ? err.message : err)
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // extension/background.ts
  var MENU_ID = "bdm-save-page";
  var SHOTS_KEY = "bdm-shots-v1";
  var SHOTS_MAX = 12;
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: MENU_ID,
        title: "Zu Bookmarks Dynamic Manager hinzuf\xFCgen",
        contexts: ["page"]
      });
    });
  });
  async function downscaleShot(dataUrl) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, 640 / bitmap.width);
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) return dataUrl;
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.55 });
      return await new Promise((resolve, reject) => {
        void out.arrayBuffer().then((buffer) => {
          let binary = "";
          for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
          resolve(`data:image/jpeg;base64,${btoa(binary)}`);
        }, reject);
      });
    } catch {
      return dataUrl;
    }
  }
  async function storeShot(bookmarkId, dataUrl) {
    try {
      const bag = await chrome.storage.local.get(SHOTS_KEY);
      const shots = bag[SHOTS_KEY] ?? {};
      shots[bookmarkId] = dataUrl;
      const ids = Object.keys(shots);
      for (const id of ids.slice(0, Math.max(0, ids.length - SHOTS_MAX))) delete shots[id];
      await chrome.storage.local.set({ [SHOTS_KEY]: shots });
    } catch {
    }
  }
  var saves = Promise.resolve({ ok: true });
  function saveCurrentTab() {
    saves = saves.catch(() => ({ ok: false })).then(saveTab).catch(() => ({ ok: false, reason: "storage", error: "Speichern fehlgeschlagen. Bitte den Manager und den verf\xFCgbaren Speicher pr\xFCfen." }));
    return saves;
  }
  async function saveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? "";
    const title = tab?.title ?? "";
    if (!/^https?:\/\//i.test(url)) return { ok: false, reason: "invalid" };
    const state = await loadStateAsync();
    const result = addBookmarkToState(state, { title, url, tags: [], categoryIds: [], pinned: false });
    if (!result) return { ok: false, reason: "duplicate" };
    let nextState = result.state;
    let bookmark = result.bookmark;
    const clicker = classifyClicker(url, title, []);
    if (clicker) {
      const info = clicker;
      bookmark = { ...bookmark, clicker: info };
      nextState = { ...nextState, bookmarks: nextState.bookmarks.map((b) => b.id === bookmark.id ? bookmark : b) };
    }
    await saveState(nextState);
    let vision = "off";
    let visionTags;
    if (state.settings.visionOnSave && state.settings.aiProvider === "api" && state.settings.aiEndpoint) {
      try {
        const raw = await chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 70 });
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
            const merged = [.../* @__PURE__ */ new Set([...bookmark.tags, ...res.tags])];
            const current = await loadStateAsync();
            const existing = current.bookmarks.find((b) => b.id === bookmark.id);
            if (!existing) return { ok: true, vision };
            const { state: s2, ids } = mapNamesToIds(res.categories, current);
            bookmark = { ...existing, tags: [.../* @__PURE__ */ new Set([...existing.tags, ...merged])], categoryIds: [.../* @__PURE__ */ new Set([...existing.categoryIds, ...ids])] };
            nextState = {
              ...s2,
              bookmarks: s2.bookmarks.map((b) => b.id === bookmark.id ? bookmark : b)
            };
            await saveState(nextState);
          }
        }
      } catch {
      }
    }
    const names = bookmark.categoryIds.map((id) => nextState.categories.find((c) => c.id === id)?.name ?? "").filter(Boolean);
    return { ok: true, categories: names, visionTags, vision };
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
          const saved = state.bookmarks.some((b) => urlKey(b.url) === urlKey(url));
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
    })().catch(() => sendResponse({ ok: false, error: "Daten konnten nicht geladen werden." }));
    return true;
  });
})();
