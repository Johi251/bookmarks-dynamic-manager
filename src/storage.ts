import type { AppState } from './types';
import { createSeedState } from './rules';

const STORAGE_KEY = 'bdm-state-v1';

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1 || !Array.isArray(parsed.bookmarks) || !Array.isArray(parsed.categories)) {
      return createSeedState();
    }
    return { ...parsed, rules: Array.isArray(parsed.rules) ? parsed.rules : [] };
  } catch {
    return createSeedState();
  }
}

export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('Speichern fehlgeschlagen', err);
    return false;
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorieren */
  }
}
