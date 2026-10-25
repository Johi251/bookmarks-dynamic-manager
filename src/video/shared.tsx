import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VideoBookmark } from './types';

/**
 * Geteilte Bausteine der Remotion-Templates: Farb- und Typo-System im
 * Premium-SaaS-Stil der App, Status-Karten (🟢 Online / 🔵 Lokal / 🟠 Checking),
 * Karten-Slide mit Feder-Einblendung und Taktkarte für 16:9 und 9:16.
 */

export const VIDEO_COLORS = {
  bg: '#0a0a0c',
  surface: 'rgba(255,255,255,0.035)',
  border: 'rgba(255,255,255,0.09)',
  text: '#f4f4f5',
  dim: '#a1a1aa',
  accent: '#8b96ff',
  green: '#34d399',
  blue: '#60a5fa',
  orange: '#fb923c',
};

export const clickerColor = (c?: VideoBookmark['clicker']): string =>
  c === 'online' ? VIDEO_COLORS.green : c === 'local' ? VIDEO_COLORS.blue : c === 'checking' ? VIDEO_COLORS.orange : VIDEO_COLORS.dim;

/** Sanfter Feder-Sprung für Einblendungen (Skalierung + Vertikalbewegung). */
export function useSpringIn(delay: number): { scale: number; translateY: number; opacity: number } {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.6 } });
  return { scale: 0.92 + 0.08 * s, translateY: interpolate(s, [0, 1], [36, 0]), opacity: Math.min(1, s * 1.6) };
}

/** Fade-Out am Ende eines Sequenz-Abschnitts. */
export function useFadeOut(last: number): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [last - 12, last - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

export function Background(): React.ReactElement {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: VIDEO_COLORS.bg }}>
      {/* dezente, langsam wandernde Akzent-Lichter */}
      <div
        style={{
          position: 'absolute',
          width: 1400,
          height: 1400,
          left: -350 + Math.sin(frame / 85) * 60,
          top: -500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,150,255,0.10) 0%, transparent 62%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1600,
          height: 1600,
          right: -500 + Math.cos(frame / 95) * 50,
          bottom: -700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 60%)',
        }}
      />
      {/* feines Raster */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />
    </AbsoluteFill>
  );
}

export function StatusChip({ clicker, scale = 1 }: { clicker?: VideoBookmark['clicker']; scale?: number }): React.ReactElement | null {
  if (!clicker) return null;
  const color = clickerColor(clicker);
  const label = clicker === 'online' ? 'Online' : clicker === 'local' ? 'Lokal' : 'Checking';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10 * scale,
        padding: `${7 * scale}px ${18 * scale}px ${7 * scale}px ${14 * scale}px`,
        borderRadius: 999,
        border: `1px solid ${color}55`,
        background: `${color}14`,
        boxShadow: `0 0 ${22 * scale}px ${color}44`,
        fontFamily: 'Segoe UI Variable Text, Segoe UI, system-ui, sans-serif',
        fontSize: 26 * scale,
        fontWeight: 600,
        color,
        letterSpacing: 0.4,
      }}
    >
      <span style={{ width: 12 * scale, height: 12 * scale, borderRadius: '50%', background: color, boxShadow: `0 0 ${14 * scale}px ${color}` }} />
      {label}
    </div>
  );
}

export function Brand({ text, size = 30, dim = false }: { text: string; size?: number; dim?: boolean }): React.ReactElement {
  return (
    <span
      style={{
        fontFamily: 'Segoe UI Variable Display, Segoe UI, system-ui, sans-serif',
        fontSize: size,
        fontWeight: 640,
        letterSpacing: -0.4,
        color: dim ? VIDEO_COLORS.dim : VIDEO_COLORS.text,
      }}
    >
      {text}
    </span>
  );
}

/** Einblend-Reihenfolge innerhalb einer Lesezeichen-Sequenz (Frames nach Start). */
export const CARD_STAGGER = [0, 4, 8];
