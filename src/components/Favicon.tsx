import { useEffect, useState } from 'react';
import { avatarColorOf, cachedSource, faviconHostOf, faviconUrl, nextSource, rememberSource, type FaviconSource } from '../favicon';

interface Props {
  url: string;
  title: string;
  size?: number;
  /** False → direkt der Buchstaben-Avatar (Einstellung „Favicons laden"). */
  enabled?: boolean;
}

/**
 * Echtes Webseiten-Logo über die Favicon-Kette (Google S2 → Icon.horse),
 * Fallback: minimalistischer Buchstaben-Avatar mit harmonischer Palette.
 */
export default function Favicon({ url, title, size = 32, enabled = true }: Props) {
  const host = faviconHostOf(url);
  const remembered = cachedSource(host);
  const [source, setSource] = useState<FaviconSource>(remembered ?? 'google-s2');

  useEffect(() => {
    setSource(cachedSource(host) ?? 'google-s2');
  }, [host]);

  const letter = (title[0] ?? host[0] ?? '?').toUpperCase();
  const baseStyle = { width: size, height: size, '--av': avatarColorOf(host) } as React.CSSProperties;

  if (!enabled || !host || source === 'letter') {
    return (
      <span className="fav-avatar" style={baseStyle} aria-hidden="true">
        {letter}
      </span>
    );
  }

  return (
    <span className="fav-wrap" style={baseStyle}>
      <img
        src={faviconUrl(source, host)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          const next = nextSource(source);
          rememberSource(host, next);
          setSource(next);
        }}
      />
    </span>
  );
}
