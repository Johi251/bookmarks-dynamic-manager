import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';
import type { VideoBookmark } from './types';
import { INTRO_FRAMES, OUTRO_FRAMES, PER_BOOKMARK_FRAMES } from './types';
import { Background, Brand, CARD_STAGGER, StatusChip, VIDEO_COLORS, clickerColor, useFadeOut, useSpringIn } from './shared';

/**
 * Template A — „Walkthrough" 16:9 (1920×1080): Breitband-Präsentation für
 * YouTube-Walkthroughs (JayTX). Intro → Lesezeichen-Karten im Takt → Outro.
 */
export const Walkthrough16x9: React.FC<{ bookmarks: VideoBookmark[]; brand: string; subtitle: string }> = ({ bookmarks, brand, subtitle }) => {
  const list = bookmarks.length > 0 ? bookmarks : [{ title: 'Noch keine Lesezeichen', host: '', tags: [], clicker: undefined as never }];
  return (
    <AbsoluteFill style={{ backgroundColor: VIDEO_COLORS.bg }}>
      <Background />
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <Intro16x9 brand={brand} subtitle={subtitle} count={bookmarks.length} />
      </Sequence>
      {list.map((bm, i) => (
        <Sequence key={i} from={INTRO_FRAMES + i * PER_BOOKMARK_FRAMES} durationInFrames={PER_BOOKMARK_FRAMES}>
          <CardScene16x9 bm={bm} index={i} brand={brand} total={list.length} />
        </Sequence>
      ))}
      <Sequence from={INTRO_FRAMES + list.length * PER_BOOKMARK_FRAMES} durationInFrames={OUTRO_FRAMES}>
        <Outro16x9 brand={brand} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Intro16x9: React.FC<{ brand: string; subtitle: string; count: number }> = ({ brand, subtitle, count }) => {
  const { scale, translateY, opacity } = useSpringIn(6);
  const fade = useFadeOut(INTRO_FRAMES);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-start', padding: 130, opacity: fade }}>
      <div style={{ transform: `translateY(${translateY}px) scale(${scale})`, opacity, display: 'flex', flexDirection: 'column', gap: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 58, height: 58, borderRadius: 16, background: `${VIDEO_COLORS.accent}22`, border: `1px solid ${VIDEO_COLORS.accent}66`, display: 'grid', placeItems: 'center' }}>
            <span style={{ width: 20, height: 20, borderRadius: 6, background: VIDEO_COLORS.accent, boxShadow: `0 0 26px ${VIDEO_COLORS.accent}` }} />
          </div>
          <Brand text={brand} size={54} />
        </div>
        <div style={{ fontSize: 40, fontWeight: 600, color: VIDEO_COLORS.text, letterSpacing: -0.5 }}>{subtitle}</div>
        <div style={{ fontSize: 27, color: VIDEO_COLORS.dim }}>
          {count} Lesezeichen · Nutzungsweg-Analyse · 1 Klick
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CardScene16x9: React.FC<{ bm: VideoBookmark; index: number; brand: string; total: number }> = ({ bm, index, brand, total }) => {
  const frame = useCurrentFrame();
  const fade = useFadeOut(PER_BOOKMARK_FRAMES);
  const card = useSpringIn(CARD_STAGGER[0]);
  const meta = useSpringIn(CARD_STAGGER[1]);
  const tags = useSpringIn(CARD_STAGGER[2]);
  const color = clickerColor(bm.clicker);
  const progress = interpolate(frame, [0, PER_BOOKMARK_FRAMES], [0, 1]);

  return (
    <AbsoluteFill style={{ padding: 120, opacity: fade }}>
      {/* Fortschrittsleiste */}
      <div style={{ position: 'absolute', top: 64, left: 120, right: 120, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 3 }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', background: VIDEO_COLORS.accent, borderRadius: 3 }} />
      </div>
      <div style={{ position: 'absolute', top: 84, left: 120, display: 'flex', gap: 18, alignItems: 'baseline' }}>
        <Brand text={brand} size={22} dim />
        <span style={{ fontSize: 22, color: VIDEO_COLORS.dim }}>{index + 1} / {total}</span>
      </div>

      <AbsoluteFill style={{ justifyContent: 'center' }}>
        <div
          style={{
            transform: `translateY(${card.translateY}px) scale(${card.scale})`,
            opacity: card.opacity,
            display: 'flex',
            flexDirection: 'column',
            gap: 30,
            padding: '56px 64px',
            borderRadius: 28,
            border: `1px solid ${VIDEO_COLORS.border}`,
            background: VIDEO_COLORS.surface,
            maxWidth: 1180,
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1.2, color: VIDEO_COLORS.text, lineHeight: 1.12, overflow: 'hidden' }}>
            {bm.title.slice(0, 64)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, opacity: meta.opacity, transform: `translateY(${meta.translateY}px)` }}>
            {bm.host && <span style={{ fontFamily: 'Consolas, monospace', fontSize: 30, color: VIDEO_COLORS.dim }}>{bm.host}</span>}
            <StatusChip clicker={bm.clicker} scale={1.15} />
          </div>
          {bm.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', opacity: tags.opacity, transform: `translateY(${tags.translateY}px)` }}>
              {bm.tags.slice(0, 5).map((t) => (
                <span
                  key={t}
                  style={{
                    padding: '9px 22px',
                    borderRadius: 999,
                    border: `1px solid ${color}40`,
                    background: `${color}10`,
                    fontSize: 25,
                    color: VIDEO_COLORS.dim,
                  }}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Outro16x9: React.FC<{ brand: string }> = ({ brand }) => {
  const { scale, opacity } = useSpringIn(4);
  const fade = useFadeOut(OUTRO_FRAMES);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: fade }}>
      <div style={{ textAlign: 'center', transform: `scale(${scale})`, opacity, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Brand text={brand} size={64} />
        <div style={{ fontSize: 30, color: VIDEO_COLORS.dim }}>Lokal. Privat. Automatisch strukturiert.</div>
      </div>
    </AbsoluteFill>
  );
};
