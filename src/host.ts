/** Hostname einer URL ohne „www." — geteilt von Liste, Video-Studio und Export. */
export function hostOf(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Hostnamen sind nicht case-sensitiv; Pfad, Query und Fragment dagegen schon. */
export function urlKey(url: string): string {
  try { return new URL(url).href.replace(/\/$/, ''); }
  catch { return url; }
}
