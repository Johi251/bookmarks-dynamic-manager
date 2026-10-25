/**
 * KI-Router: eine einheitliche Schnittstelle für die Import-Strukturierung.
 * Standard ist die lokale Engine (offline, kostenlos). Ist in den Einstellungen
 * eine eigene OpenAI-kompatible API konfiguriert, wird diese genutzt — bei
 * jedem Fehler fällt der Router transparent auf die lokale Engine zurück.
 */
import type { AppSettings, GlossaryEntry } from '../types';
import { getAiApiKey } from '../storage';
import { analyzeBookmark, type SmartAnalysis } from './engine';

export interface AiRouteInfo {
  /** Tatsächlich genutzter Provider (nach Fallback). */
  used: 'local' | 'api';
  /** Kurzform des Fehlers, falls die API scheiterte und lokal weitergemacht wurde. */
  fallbackReason?: string;
}

export interface AiItem {
  url: string;
  title: string;
  existingTags: string[];
}

export interface AiRouteResult {
  results: SmartAnalysis[];
  info: AiRouteInfo;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Ruft eine OpenAI-kompatible Chat-Completions-API im JSON-Modus auf. */
async function callApi(
  items: AiItem[],
  settings: AppSettings,
  glossary: GlossaryEntry[],
  signal: AbortSignal
): Promise<SmartAnalysis[]> {
  const key = getAiApiKey();
  const endpoint = settings.aiEndpoint.replace(/\/+$/, '');
  const glossaryContext = glossary.length
    ? glossary.map((g) => `${g.term} = ${g.definition} [verwandt: ${g.related.join(', ')}]`).join('\n')
    : '(noch leer)';
  const payload = {
    model: settings.aiModel || 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Du strukturierst Lesezeichen. Gib für jeden Link passende Schlagwörter (Meta-Tags, klein geschrieben, ' +
          'max. 5) und optional Kategorienamen zurück. Nutze das Glossar des Nutzers, wenn ein Begriff passt. ' +
          'Antworte ausschließlich als JSON: {"results":[{"index":0,"tags":["..."],"categories":["..."]}]}.',
      },
      { role: 'user', content: `Glossar:\n${glossaryContext}\n\nLinks (Index beachten):\n${JSON.stringify(items.map((it, i) => ({ index: i, url: it.url, title: it.title })))}` },
    ],
  };

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new Error(`API antwortete mit HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? '';
  const parsed = JSON.parse(content) as { results?: Record<string, unknown>[] };
  const out: SmartAnalysis[] = items.map(() => ({ tags: [], categories: [] }));
  for (const r of parsed.results ?? []) {
    const idx = Number(r.index);
    if (Number.isInteger(idx) && idx >= 0 && idx < out.length) {
      out[idx] = { tags: toStringArray(r.tags).map((t) => t.toLowerCase()), categories: toStringArray(r.categories) };
    }
  }
  return out;
}

/**
 * Strukturiert eine Liste von Links. Nutzt die konfigurierte API, falls
 * vollständig eingerichtet; andernfalls (oder bei Fehler) die lokale Engine.
 * Max. 40 Links pro API-Aufruf (Batch), dazwischen lokale Ergänzung.
 */
export async function analyzeBatch(
  items: AiItem[],
  settings: AppSettings,
  glossary: GlossaryEntry[]
): Promise<AiRouteResult> {
  const local = (): SmartAnalysis[] => items.map((it) => analyzeBookmark(it.url, it.title, it.existingTags, glossary));

  if (settings.aiProvider === 'api' && settings.aiEndpoint && getAiApiKey()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const results: SmartAnalysis[] = [];
      for (let i = 0; i < items.length; i += 40) {
        const chunk = items.slice(i, i + 40);
        const apiResults = await callApi(chunk, settings, glossary, controller.signal);
        // API-Ergebnis mit lokaler Engine anreichern (falls die API lückenhaft antwortet).
        results.push(
          ...apiResults.map((r, j) => {
            const fallback = analyzeBookmark(chunk[j].url, chunk[j].title, [...chunk[j].existingTags, ...r.tags], glossary);
            return { tags: [...new Set([...r.tags, ...fallback.tags])], categories: [...new Set([...r.categories, ...fallback.categories])] };
          })
        );
      }
      clearTimeout(timer);
      return { results, info: { used: 'api' } };
    } catch (err) {
      clearTimeout(timer);
      return { results: local(), info: { used: 'local', fallbackReason: String(err instanceof Error ? err.message : err) } };
    }
  }
  return { results: local(), info: { used: 'local' } };
}
