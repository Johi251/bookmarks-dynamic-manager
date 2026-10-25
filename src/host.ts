/** Hostname einer URL ohne „www." — geteilt von Liste, Video-Studio und Export. */
export function hostOf(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
