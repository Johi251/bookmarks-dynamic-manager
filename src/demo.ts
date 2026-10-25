import type { Bookmark } from './types';

/** Generische Demo-Daten (keine privaten Lesezeichen!) zum sofortigen Ausprobieren. */
const DAY = 86_400_000;
const now = Date.now();

const raw: [string, string, string, number][] = [
  ['OpenAI', 'https://openai.com/', '', 0],
  ['Claude — Anthropic', 'https://anthropic.com/claude', '', 1],
  ['Hermes Agent Skills', 'https://github.com/example/hermes-agent-skills', 'ki hermes', 1],
  ['Awesome LLM Agents', 'https://github.com/example/awesome-llm-agents', 'ki agenten', 2],
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
