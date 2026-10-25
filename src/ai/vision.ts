/**
 * Multimodale Vision-Erweiterung: analysiert einen Seiten-Screenshot mit
 * einem OpenAI-kompatiblen Vision-Modell (Standard: GLM-5.3 Flash) und
 * verschlagwortet das Lesezeichen anhand des VISUELLEN Inhalts — Oberfläche,
 * Werkzeugart, erkennbare Themen — und ordnet es ins Glossar ein.
 *
 * Genutzt vom Browser-Add-on (MV3) beim Speichern: optionaler Screenshot
 * der sichtbaren Seite → automatische Tags/Kategorien ohne Netzsuche.
 * Ohne konfigurierte API oder bei Fehlern wird die lokale Text-Engine
 * (url/title/glossary) als Fallback genutzt.
 */
import type { AppSettings, GlossaryEntry } from '../types';
import { getAiApiKey } from '../storage';
import { analyzeBookmark, type SmartAnalysis } from './engine';

export interface VisionResult extends SmartAnalysis {
  /** Tatsächlich genutzter Weg (Vision-API oder lokaler Fallback). */
  used: 'vision' | 'local';
  fallbackReason?: string;
  /** Kurze Beschreibung des visuellen Inhalts (Vision-Modell, optional). */
  visualSummary?: string;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Sendet den Screenshot (JPEG-Data-URL) an das Vision-Modell und erwartet
 * Schlagwörter + Kategorien + eine Zeile Beschreibung als JSON.
 */
export async function analyzeScreenshot(
  imageDataUrl: string,
  bookmark: { url: string; title: string; existingTags: string[] },
  settings: AppSettings,
  glossary: GlossaryEntry[],
  signal?: AbortSignal
): Promise<VisionResult> {
  const local = (): VisionResult => ({
    ...analyzeBookmark(bookmark.url, bookmark.title, bookmark.existingTags, glossary),
    used: 'local',
  });

  const endpoint = settings.aiEndpoint.trim().replace(/\/+$/, '');
  const model = (settings.visionModel || 'glm-5.3-flash').trim();
  const key = getAiApiKey();
  if (settings.aiProvider !== 'api' || !endpoint || !key || !imageDataUrl.startsWith('data:image/')) {
    return local();
  }

  const glossaryContext = glossary.length
    ? glossary.map((g) => `${g.term} = ${g.definition} [verwandt: ${g.related.join(', ')}]`).join('\n')
    : '(noch leer)';

  const payload = {
    model,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'Du analysierst Screenshots von Webseiten für eine Lesezeichen-Verwaltung. Beschreibe kurz das, ' +
          'was auf dem Screenshot ZU SEHEN ist (Art der Anwendung, Oberfläche, erkennbare Themen), und leite ' +
          'daraus Schlagwörter und passende Kategorien ab. Nutze das Glossar des Nutzers, wenn ein Begriff passt. ' +
          'Antworte ausschließlich als JSON: {"tags":["..."],"categories":["..."],"visual":"<ein Satz>"} ' +
          '(tags: max. 5, kleingeschrieben).',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Glossar:\n${glossaryContext}\n\nLesezeichen: ${bookmark.title}\n${bookmark.url}\n\nAnalysiere den Screenshot.`,
          },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
  };

  const controller = new AbortController();
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Vision-API antwortete mit HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as Record<string, unknown>) : {};
    const tags = toStringArray(parsed.tags).map((t) => t.toLowerCase().replace(/\s+/g, '-')).slice(0, 5);
    const categories = toStringArray(parsed.categories).slice(0, 4);
    const visual = typeof parsed.visual === 'string' ? parsed.visual : undefined;
    // Mit der lokalen Text-Engine anreichern (URL/Titel/Glossar liefern ergänzende Signale).
    const fallback = analyzeBookmark(bookmark.url, bookmark.title, [...bookmark.existingTags, ...tags], glossary);
    return {
      tags: [...new Set([...tags, ...fallback.tags])].slice(0, 8),
      categories: [...new Set([...categories, ...fallback.categories])],
      used: 'vision',
      visualSummary: visual,
    };
  } catch (err) {
    return {
      ...local(),
      fallbackReason: String(err instanceof Error ? err.message : err),
    };
  } finally {
    clearTimeout(timer);
  }
}
