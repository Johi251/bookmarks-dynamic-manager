import { isWebUrl } from './storage';
import type { ClickerInfo } from './types';

type Desktop = { core: { invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> } };
const desktop = () => (window as unknown as { __TAURI__?: Desktop }).__TAURI__;
export interface HuntItem { id: string; url: string; title: string; capturedAt?: string }

export async function readHunt(): Promise<{ items: HuntItem[]; status: string }> {
  if (!desktop()) return { items: [], status: "Today's Hunt empfängt URLs aus copyNpaste in der Windows-/Mac-Desktop-App." };
  const result = await desktop()!.core.invoke<{ items: HuntItem[]; status: string }>('hunt_pending');
  if (!Array.isArray(result.items) || result.items.some((item) => typeof item.id !== 'string' || typeof item.title !== 'string' || !isWebUrl(item.url))) throw new Error('Ungültige Daten im lokalen Hunt-Eingang.');
  return result;
}
export async function acknowledgeHunt(ids: string[]): Promise<void> {
  if (desktop()) await desktop()!.core.invoke('hunt_ack', { ids });
}

/** Nur bekannte lokale Protokollpfade; keine vom Lesezeichen vorgegebenen Befehle. */
export function aklikUrl(url: string): string {
  if (!isWebUrl(url)) throw new Error('Ungültiger Repository-Link');
  return `http://127.0.0.1:43110/#inspect=${encodeURIComponent(url)}`;
}

export function clickerFromBridge(raw: unknown, url: string, previous: ClickerInfo): ClickerInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.schema !== 'aklik-deployer.status.v1' || typeof r.url !== 'string' || r.url.replace(/\/$/, '') !== url.replace(/\/$/, '') ||
    !['checking', 'online', 'local', 'needs_review', 'error'].includes(String(r.state)) || typeof r.note !== 'string') return null;
  const online = r.state === 'online' && r.onlineReady === true && isWebUrl(r.launchUrl);
  const local = r.state === 'local' && r.localReady === true;
  return { ...previous, status: online ? 'online' : local ? 'local' : r.state === 'checking' ? 'checking' : 'none',
    launchUrl: online ? r.launchUrl as string : undefined, checkedAt: Date.now(), verified: online || local,
    reason: `aKlik: ${r.note}` };
}

export async function checkAklik(url: string, previous: ClickerInfo, signal: AbortSignal): Promise<ClickerInfo | null> {
  // Web-Hosting darf nicht still auf lokale Dienste zugreifen.
  const extension = ['chrome-extension:', 'moz-extension:'].includes(location.protocol);
  if (!extension && !desktop()) return null;
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(`http://127.0.0.1:43110/bridge/v1/status?${new URLSearchParams({ url })}`, { signal });
    const result = response.ok ? clickerFromBridge(await response.json(), url, previous) : null;
    if (!result || result.status !== 'checking') return result;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    if (signal.aborted) return null;
    }
    return null;
  } catch { return null; }
}
