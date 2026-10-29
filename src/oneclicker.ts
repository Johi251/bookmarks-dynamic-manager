/**
 * 1Clicker-Protokoll — Nutzungsweg-Analyse für Software-/Repository-Links,
 * angelehnt an die Logik des 1Clicker-Werkzeugkastens: Zu jedem Werkzeug wird
 * ein verständlicher NUTZUNGSWEG ermittelt — „direkt online nutzen" (🟢) oder
 * „auf dem eigenen PC nutzen" (🔵 Docker / portable Assets / Start-Skript).
 *
 * Zwei Phasen:
 * 1. `classifyClicker` — deterministische statische Klassifikation aus URL,
 *    Titel und Tags (sofort, offline, testbar). Repositories starten auf
 *    „checking" (🟠 blinkend).
 * 2. `refineRepo` — asynchrone Hintergrund-Analyse über die öffentliche
 *    GitHub-API (Homepage, GitHub-Pages, Releases mit portablen Assets,
 *    Dockerfile). Ergebnisse werden auf dem Lesezeichen persistiert.
 */
import type { Bookmark, ClickerInfo } from './types';

/** Revaldierung: nach 14 Tagen wird ein Nutzungsweg neu geprüft. */
export const CLICKER_RECHECK_MS = 14 * 86_400_000;

const REPO_HOSTS = new Set(['github.com', 'gitlab.com', 'codeberg.org', 'sourceforge.net']);

/** Hosts/Suffixes, die eine frei nutzbare, gehostete Web-Anwendung signalisieren. */
const HOSTED_WEB_SUFFIXES = [
  'vercel.app', 'netlify.app', 'github.io', 'pages.dev', 'render.com', 'railway.app',
  'huggingface.space', 'streamlit.app', 'replit.app', 'fly.dev', 'herokuapp.com',
  'web.app', 'firebaseapp.com', 'cloudflareworkers.com', 'deno.dev', 'glitch.me',
];

/** Titel-/URL-Signale für lokale 1-Klick-Bereitstellung. */
const LOCAL_SIGNALS: { pattern: RegExp; kind: ClickerInfo['kind']; reason: string }[] = [
  { pattern: /start-1clicker\.cmd/i, kind: 'cmd', reason: 'START-1CLICKER.cmd vorhanden' },
  { pattern: /\bdocker[- ]?(compose|file|image)?\b|\/docker\b/i, kind: 'docker', reason: 'Docker-Unterstützung erkannt' },
  { pattern: /portable|standalone[- ]exe|\.exe\b|x64[- ]zip|win(?:dows)?[- ](?:portable|zip)/i, kind: 'portable', reason: 'Portable Windows-Assets erkannt' },
];

export interface RepoRef {
  owner: string;
  name: string;
  cloneUrl: string;
  host: string;
}

/** Parst „owner/name" aus einer Repository-URL (GitHub, GitLab, Codeberg). */
export function parseRepo(url: string): RepoRef | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (!REPO_HOSTS.has(u.hostname.toLowerCase().replace(/^www\./, ''))) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const name = parts[1].replace(/\.git$/, '');
    if (!/^[A-Za-z0-9_.-]+$/.test(parts[0]) || !/^[A-Za-z0-9_.-]+$/.test(name)) return null;
    return { owner: parts[0], name, cloneUrl: `https://${u.hostname}/${parts[0]}/${name}.git`, host: u.hostname.toLowerCase() };
  } catch {
    return null;
  }
}

/** Statische Klassifikation — deterministisch, offline, ohne Netzwerk. */
export function classifyClicker(url: string, title: string, tags: string[] = []): ClickerInfo | undefined {
  let host = '';
  try {
    host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return undefined;
  }
  const haystack = `${title} ${url} ${tags.join(' ')}`;

  // 1) Lokale 1-Klick-Signale in Titel/URL/Tags (🔵) — schlagen auch das
  //    Repository-Checking vor: ist der Nutzungsweg schon erkennbar, wird er
  //    sofort gesetzt (Repo-Koordinaten werden dennoch mitgegeben).
  for (const sig of LOCAL_SIGNALS) {
    if (sig.pattern.test(haystack)) {
      const repo = parseRepo(url);
      return {
        status: 'local',
        kind: sig.kind,
        reason: sig.reason, verified: false,
        repo: repo ? { owner: repo.owner, name: repo.name, cloneUrl: repo.cloneUrl } : undefined,
      };
    }
  }

  // 2) Gehostete Web-Anwendung → direkt online nutzbar (🟢).
  if (HOSTED_WEB_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) {
    return { status: 'online', kind: 'web', launchUrl: url, reason: `Gehostete Webseite (${host}); Kosten und Funktion ungeprüft`, verified: false };
  }

  // 3) Repository-Links: Nutzungsweg wird im Hintergrund verfeinert (🟠 Checking).
  if (REPO_HOSTS.has(host)) {
    const repo = parseRepo(url);
    if (repo) {
      return { status: 'checking', kind: 'repo', repo: { owner: repo.owner, name: repo.name, cloneUrl: repo.cloneUrl } };
    }
  }

  // Kein Software-/Repository-Bezug → keine Badge.
  return undefined;
}

/** True, wenn der Nutzungsweg (nochmal) im Hintergrund geprüft werden soll. */
export function needsCheck(bm: Bookmark): boolean {
  const c = bm.clicker;
  if (!c) return false;
  if (c.status === 'online' || c.status === 'local') {
    return Boolean(c.repo && (!c.checkedAt || Date.now() - c.checkedAt > CLICKER_RECHECK_MS));
  }
  if (c.status === 'checking') return !c.checkedAt || Date.now() - c.checkedAt > CLICKER_RECHECK_MS;
  return false;
}

// ── GitHub-Hintergrundanalyse (öffentliche REST-API, ohne Schlüssel) ─────────

interface GhRepo {
  homepage?: string | null;
  has_pages?: boolean;
  description?: string | null;
  topics?: string[];
  default_branch?: string;
  html_url?: string;
}

interface GhRelease {
  html_url?: string;
  assets?: { name: string; browser_download_url: string; size?: number }[];
}

const PORTABLE_ASSET = /\.(exe|zip|7z|appx|msi|portable)$/i;

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Verfeinert die Nutzungsweg-Analyse eines GitHub-Repositories:
 * Homepage → 🟢 · GitHub-Pages → 🟢 · portables Release-Asset → 🔵 ·
 * Dockerfile im Default-Branch → 🔵 · sonst statische Signale aus
 * Beschreibung/Topics. Wirft bei Netzwerk-/Rate-Limit-Fehlern (Aufrufer
 * behandelt das als „später erneut", der Status bleibt 🟠 checking).
 */
export async function refineRepo(
  info: ClickerInfo,
  signal: AbortSignal
): Promise<ClickerInfo> {
  info = { ...info, verified: false };
  if (!info.repo) return info;
  const { owner, name } = info.repo;
  if (new URL(info.repo.cloneUrl).hostname !== 'github.com') return { ...info, status: 'none', checkedAt: Date.now(), verified: false, reason: 'Nutzungsweg bitte über aKlik prüfen.' };
  const base = `https://api.github.com/repos/${owner}/${name}`;
  const checkedAt = Date.now();

  let repo: GhRepo | null = null;
  try {
    repo = await fetchJson<GhRepo>(base, signal);
  } catch (err) {
    // API nicht erreichbar (offline, Rate-Limit) → prüfen, ob Dockerfile existiert.
    if (await hasDockerfile(owner, name, 'HEAD', signal)) {
      return { ...info, status: 'local', kind: 'docker', checkedAt, reason: 'Dockerfile im Repository' };
    }
    throw err;
  }

  // 🟢 Homepage des Repos = Live-Anwendung.
  const homepage = (repo.homepage ?? '').trim();
  if (/^https?:\/\//.test(homepage)) {
    return { ...info, status: 'online', kind: 'web', launchUrl: homepage, checkedAt, verified: false, reason: 'Repository-Homepage; Funktion und Kosten nicht verifiziert' };
  }

  // 🟢 GitHub-Pages-Demo.
  if (repo.has_pages) {
    return {
      ...info,
      status: 'online',
      kind: 'web',
      launchUrl: `https://${owner}.github.io/${name}/`,
      checkedAt,
      reason: 'GitHub-Pages-Demo vorhanden',
    };
  }

  // 🔵 Portables Release-Asset (exe/zip) → 1-Klick-Download.
  try {
    const rel = await fetchJson<GhRelease>(`${base}/releases/latest`, signal);
    const asset = (rel.assets ?? []).find((a) => PORTABLE_ASSET.test(a.name));
    if (asset && rel.html_url) {
      return { ...info, status: 'local', kind: 'portable', launchUrl: rel.html_url, checkedAt, reason: `Release-Asset „${asset.name}"` };
    }
  } catch {
    /* kein Release vorhanden — weiter prüfen */
  }

  // 🔵 Dockerfile im Default-Branch.
  if (await hasDockerfile(owner, name, repo.default_branch ?? 'main', signal)) {
    return { ...info, status: 'local', kind: 'docker', checkedAt, reason: 'Dockerfile im Repository' };
  }

  // Statische Signale aus Beschreibung/Topics (z. B. „docker", „windows", „desktop").
  const meta = `${repo.description ?? ''} ${(repo.topics ?? []).join(' ')}`.toLowerCase();
  if (/\bdocker|containeri[sz]ed?\b/.test(meta)) {
    return { ...info, status: 'local', kind: 'docker', checkedAt, reason: 'Docker laut Beschreibung/Topics' };
  }
  if (/portable|windows|desktop app|\.exe/.test(meta)) {
    return { ...info, status: 'local', kind: 'portable', checkedAt, reason: 'Desktop-/Windows-App laut Beschreibung' };
  }

  // Analysiert, aber kein 1-Klick-Weg erkannt → keine Badge.
  return { ...info, status: 'none', checkedAt, reason: 'Kein 1-Klick-Weg erkannt' };
}

async function hasDockerfile(owner: string, name: string, branch: string, signal: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${name}/${branch}/Dockerfile`, {
      method: 'GET',
      signal,
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Rezept für die lokale Bereitstellung (🔵 Badge-Klick) ────────────────────

export interface DeployStep {
  label: string;
  command?: string;
  link?: string;
}

/**
 * Liefert die 1-Klick-Schritte zur lokalen Bereitstellung: Docker-Start,
 * portablem Release-Download oder START-1CLICKER — je nach erkannter Art.
 */
export function deploySteps(bm: Bookmark): DeployStep[] {
  const info = bm.clicker;
  if (!info) return [];
  const repo = info.repo;
  const repoUrl = repo ? `https://github.com/${repo.owner}/${repo.name}` : bm.url;

  switch (info.kind) {
    case 'docker':
      return [
        { label: 'Repository klonen', command: `git clone ${repo?.cloneUrl ?? bm.url + '.git'}` },
        { label: 'Nur bei vorhandener Compose-Datei: im Projektordner ausführen; Ports und Umgebungsvariablen laut README prüfen', command: 'docker compose up -d' },
        { label: 'Repository öffnen (README/Anleitung)', link: repoUrl },
      ];
    case 'portable':
      return [
        { label: 'Portables Release-Asset herunterladen (exe/zip — entpacken & starten)', link: info.launchUrl ?? `${repoUrl}/releases/latest` },
        { label: 'Releases-Übersicht öffnen', link: `${repoUrl}/releases` },
      ];
    case 'cmd':
      return [
        { label: 'Repository klonen (enthält START-1CLICKER.cmd)', command: `git clone ${repo?.cloneUrl ?? bm.url + '.git'}` },
        { label: '1Clicker-Starter ausführen', command: `cd ${repo?.name ?? 'repo'} && START-1CLICKER.cmd` },
        { label: 'Repository öffnen', link: repoUrl },
      ];
    case 'repo':
    case 'web':
    default:
      return [{ label: 'Repository öffnen (Nutzungsweg im README prüfen)', link: repoUrl }];
  }
}

/** Nächstes Re-Check-Intervall für die Hintergrund-Queue (Rate-Limit-freundlich). */
export const CLICKER_QUEUE_DELAY_MS = 1_500;
/** Maximal analysierte Repos pro App-Sitzung (GitHub erlaubt 60 Requests/Stunde ohne Token). */
export const CLICKER_SESSION_LIMIT = 25;
