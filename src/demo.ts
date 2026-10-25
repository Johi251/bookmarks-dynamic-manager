import type { Bookmark } from './types';

/** Generische Demo-Daten (keine privaten Lesezeichen!) zum sofortigen Ausprobieren.
    Enthält Beispiele für Glossar/Cross-Verlinkung (SMMA, JayTX, ROFLnator.90). */
const DAY = 86_400_000;
const now = Date.now();

const raw: [string, string, string, number][] = [
  ['OpenAI', 'https://openai.com/', '', 0],
  ['Claude — Anthropic', 'https://anthropic.com/claude', '', 1],
  ['Hermes Agent Skills', 'https://github.com/example/hermes-agent-skills', 'ki hermes', 1],
  ['Awesome LLM Agents', 'https://github.com/example/awesome-llm-agents', 'ki agenten top', 2],
  ['Hugging Face — Modelle', 'https://huggingface.co/models', 'modelle', 3],
  ['Vite — Build Tool', 'https://vite.dev/guide/', 'frontend', 4],
  ['MDN Web Docs', 'https://developer.mozilla.org/de/', 'dokumentation', 5],
  ['Docker Hub', 'https://hub.docker.com/', 'container', 6],
  ['Free for Developers', 'https://free-for.dev/#/', 'kostenlos', 7],
  ['FreeStuff.dev', 'https://freestuff.dev/', 'kostenlos', 8],
  ['PromptBase', 'https://promptbase.com/', 'prompts', 9],
  ['Stack Overflow', 'https://stackoverflow.com/', 'qa', 12],
  ['Wikipedia', 'https://de.wikipedia.org/', 'lexikon', 15],
  ['YouTube', 'https://www.youtube.com/', 'video', 20],
  // Glossar-/Cross-Link-Demo (Begriffe aus dem Auftrag):
  ['SMMA Guide — Social Media Marketing', 'https://smma.example.com/guide', 'smma marketing', 2],
  ['JayTX — Lyric Videos & Musik-Vertrieb', 'https://jaytx.example.com/', 'musik smma', 3],
  ['ROFLnator.90 — MEME SMMA Auto-Posting', 'https://roflnator90.example.com/', 'memes smma', 4],
  ['Drive-Ordner — Assets & Vorlagen', 'https://drive.example.com/assets', 'assets', 6],
  // 1Clicker-Demo (Nutzungswege): gehostete Web-App, Docker-Repo, portable Release, Repository:
  ['Excalidraw — Whiteboard', 'https://excalidraw.com/', 'whiteboard zeichnen', 1],
  ['Itty-Bitty — gehostete Mini-Apps', 'https://itty.bitty.example.app/', 'tools', 2],
  ['DockGE — Docker Compose Manager', 'https://github.com/example/dockge-compose-ui', 'docker container', 3],
  ['Uptime-Kuma — Monitoring portable', 'https://github.com/example/uptime-kuma-monitor', 'monitoring portable exe', 5],
  ['Awesome-Selfhosted Übersicht', 'https://github.com/example/awesome-selfhosted-list', 'selfhosted link-datenbanken', 8],
];

export function createDemoBookmarks(): Bookmark[] {
  return raw.map(([title, url, tags, daysAgo], i) => ({
    id: `demo-${i}`,
    title,
    url,
    added: now - daysAgo * DAY - i * 60_000,
    tags: tags ? tags.split(' ') : [],
    categoryIds: [],
    pinned: i === 0 || i === 4,
  }));
}
