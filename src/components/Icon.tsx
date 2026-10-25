/**
 * Schlankes Inline-SVG-Icon-Set (Strichstil, 1.75px) — bewusst ohne
 * Icon-Paket-Abhängigkeit und ohne Emoji-Optik.
 */
export type IconName =
  | 'bookmark' | 'search' | 'plus' | 'upload' | 'settings' | 'sun' | 'moon'
  | 'pin' | 'edit' | 'trash' | 'link' | 'tag' | 'book' | 'sparkles' | 'layers'
  | 'minimize' | 'maximize' | 'x' | 'check' | 'chevronRight' | 'chevronDown'
  | 'star' | 'command' | 'hash' | 'external' | 'folder' | 'refresh' | 'alert'
  | 'clock' | 'github' | 'bot' | 'help' | 'target' | 'arrowRight' | 'minus'
  | 'zap' | 'monitor' | 'camera' | 'film' | 'download' | 'shield' | 'terminal';

const PATHS: Record<IconName, string> = {
  bookmark: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM16 16l4.5 4.5',
  plus: 'M12 5v14M5 12h14',
  upload: 'M12 16V4m0 0 4 4m-4-4L8 8M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8.4 3a8.4 8.4 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a8.6 8.6 0 0 0-2.2-1.3L15.4 3h-4l-.4 2.5a8.6 8.6 0 0 0-2.2 1.3l-2.3-1-2 3.4 2 1.5a8.4 8.4 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-1a8.6 8.6 0 0 0 2.2 1.3l.4 2.5h4l.4-2.5a8.6 8.6 0 0 0 2.2-1.3l2.3 1 2-3.4-2-1.5c.06-.43.1-.86.1-1.3Z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z',
  pin: 'M9 3h6l-1 7 3 3H7l3-3-1-7ZM12 13v8',
  edit: 'M4 20h4L20 8l-4-4L4 16v4ZM14 6l4 4',
  trash: 'M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6',
  link: 'M9.5 14.5 14.5 9.5M8 12l-2.5 2.5a3.5 3.5 0 0 0 5 5L13 17M11 7l2.5-2.5a3.5 3.5 0 0 1 5 5L16 12',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9ZM7.5 7.5h.01',
  book: 'M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4ZM17 20h2V7M8 8h6M8 12h6',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15Z',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5',
  minimize: 'M5 12h14',
  maximize: 'M5 12h14M12 5v14',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 13l4 4L19 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8L12 3.5Z',
  command: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z',
  hash: 'M5 9h14M5 15h14M10 4 8 20M16 4l-2 16',
  external: 'M14 5h5v5M19 5l-8 8M9 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3',
  folder: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4',
  alert: 'M12 4 2.5 20h19L12 4Zm0 6v4m0 3v.01',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 3v5l3.5 2',
  github: 'M9.5 20.5v-2.8c-3 .5-3.8-1.3-4.1-2-.2-.5-.9-1.7-1.5-2-.5-.3-1.2-1 0-1 1 0 1.8 1 2.1 1.6.9 1.6 2.4 1.2 3 .9.1-.8.4-1.4.8-1.7-2.7-.3-4.4-1.4-4.4-4 0-1.1.4-2 1-2.7-.3-.8-.3-1.9.1-2.6 0 0 1.1 0 2.3 1.2a7.6 7.6 0 0 1 4 0C14 5 15.1 5 15.1 5c.4.7.4 1.8.1 2.6.6.7 1 1.6 1 2.7 0 2.6-1.7 3.7-4.4 4 .5.4.9 1.2.9 2.3v3.9',
  bot: 'M8 8h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2ZM12 4v4M9.5 13h.01M14.5 13h.01M9 17h6',
  help: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 11v.01M10 9.5a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.8',
  target: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 4h.01',
  arrowRight: 'M5 12h14m0 0-6-6m6 6-6 6',
  minus: 'M12 5v14M5 5l14 14M19 5 5 19',
  zap: 'M13 2 4.5 13.5H11l-1 8.5L19.5 10.5H13l0-8.5Z',
  monitor: 'M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM9 20h6M12 16v4',
  camera: 'M4 8a1 1 0 0 1 1-1h2.5l1.5-2h6l1.5 2H19a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Zm8 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  film: 'M3 5h18v14H3V5Zm0 4h18M3 15h18M7 5v14M17 5v14',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M5 19h14',
  shield: 'M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Zm-2.5 9 2 2 4-4.5',
  terminal: 'M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3 4 2.5 2.5L8 15m5 0h4',
};

interface Props {
  name: IconName;
  size?: number;
  className?: string;
}

export default function Icon({ name, size = 16, className }: Props) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
