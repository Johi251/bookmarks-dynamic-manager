/** Native Builds enthalten ihre App-Shell bereits; alte PWA-Worker dürfen sie nicht ersetzen. */
export async function prepareOffline(enabled: boolean): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return true;
  const native = '__TAURI_INTERNALS__' in window || location.hostname === 'tauri.localhost' || location.protocol === 'tauri:';
  if (native) {
    const controlled = !!navigator.serviceWorker.controller;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if (controlled) { location.reload(); return false; }
  } else if (enabled) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => undefined); });
  }
  return true;
}
