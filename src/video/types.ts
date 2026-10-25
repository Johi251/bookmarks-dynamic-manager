/** Gemeinsame Typen der Remotion-Video-Engine (Templates A + B). */

export interface VideoBookmark {
  title: string;
  host: string;
  tags: string[];
  /** 1Clicker-Nutzungsweg — färbt die Status-Karte im Video. */
  clicker?: 'online' | 'local' | 'checking';
}

export interface VideoProps {
  brand: string;
  subtitle: string;
  bookmarks: VideoBookmark[];
}

/** Frames: 2,5 s Intro + 2,75 s pro Lesezeichen + 2,5 s Outro (bei 30 fps). */
export const INTRO_FRAMES = 75;
export const PER_BOOKMARK_FRAMES = 82;
export const OUTRO_FRAMES = 75;
export const VIDEO_FPS = 30;

export function videoDurationFrames(bookmarkCount: number): number {
  return INTRO_FRAMES + PER_BOOKMARK_FRAMES * Math.max(bookmarkCount, 1) + OUTRO_FRAMES;
}

/** Erlaubte Länge für Renders (Remotion-CLI-Limit). */
export function clampBookmarks(bookmarks: VideoBookmark[], max = 24): VideoBookmark[] {
  return bookmarks.slice(0, max);
}
