/** Konfigurierbares Tastenkürzel für den Schnellzugriff (Standard: Strg+F). */
export interface ShortcutCombo {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string; // Kleinbuchstabe oder Ziffer, z. B. "f", "k"
}

const STORAGE_KEY = 'bdm-shortcut';

export const DEFAULT_SHORTCUT: ShortcutCombo = { ctrl: true, shift: false, alt: false, meta: false, key: 'f' };

export function parseShortcut(raw: string | null): ShortcutCombo {
  if (!raw) return { ...DEFAULT_SHORTCUT };
  const parts = raw.split('+');
  const key = parts.pop() ?? 'f';
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta'),
    key: key.slice(0, 1).toLowerCase(),
  };
}

export function serializeShortcut(c: ShortcutCombo): string {
  const mods = [c.ctrl && 'ctrl', c.shift && 'shift', c.alt && 'alt', c.meta && 'meta'].filter(Boolean);
  return [...mods, c.key].join('+');
}

export function loadShortcut(): ShortcutCombo {
  try {
    return parseShortcut(localStorage.getItem(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_SHORTCUT };
  }
}

export function storeShortcut(c: ShortcutCombo): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeShortcut(c));
  } catch {
    /* ignorieren */
  }
}

export function formatShortcut(c: ShortcutCombo): string {
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent);
  const parts: string[] = [];
  if (c.ctrl) parts.push(isMac ? '⌃' : 'Strg');
  if (c.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (c.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (c.meta) parts.push(isMac ? '⌘' : 'Win');
  parts.push(c.key.toUpperCase());
  return parts.join(' + ');
}

export function matchesShortcut(e: KeyboardEvent, c: ShortcutCombo): boolean {
  const key = e.key.toLowerCase();
  if (['control', 'shift', 'alt', 'meta'].includes(key)) return false;
  return (
    e.ctrlKey === c.ctrl &&
    e.shiftKey === c.shift &&
    e.altKey === c.alt &&
    e.metaKey === c.meta &&
    key === c.key
  );
}
