import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';
import type { VideoBookmark } from './types';
import { INTRO_FRAMES, OUTRO_FRAMES, PER_BOOKMARK_FRAMES } from './types';
import { Background, Brand, CARD_STAGGER, StatusChip, VIDEO_COLORS, clickerColor, useFadeOut, useSpringIn } from './shared';

/**
 * Template B — „Short" 9:16 (1080×1920): Hochkant-Präsentation für
 * TikTok/Shorts (ROFLnator.90). Große Typo, vertikaler Takt, Status-Glow.
 */
export const Short9x16: React.FC<{ bookmarks: VideoBookmark[]; brand: string; subtitle: string }> = ({ bookmarks, brand, subtitle }) => {
  const list = bookmarks.length > 0 ? bookmarks : [{ title: 'Noch keine Lesezeichen', host: '', tags: [], clicker: undefined as never }];
  return (
    <AbsoluteFill style={{ backgroundColor: VIDEO_COLORS.bg }}>
      <Background />
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <Intro9x16 brand={brand} subtitle={subtitle} count={bookmarks.length} />
      </Sequence>
      {list.map((bm, i) => (
        <Sequence key={i} from={INTRO_FRAMES + i * PER_BOOKMARK_FRAMES} durationInFrames={PER_BOOKMARK_FRAMES}>
          <CardScene9x16 bm={bm} index={i} total={list.length} />
        </Sequence>
      ))}
      <Sequence from={INTRO_FRAMES + list.length * PER_BOOKMARK_FRAMES} durationInFrames={OUTRO_FRAMES}>
        <Outro9x16 brand={brand} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Intro9x16: React.FC<{ brand: string; subtitle: string; count: number }> = ({ brand, subtitle, count }) => {
  const { translateY, opacity } = useSpringIn(6);
  const fade = useFadeOut(INTRO_FRAMES);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: fade }}>
      <div style={{ transform: `translateY(${translateY}px)`, opacity, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 34, padding: 90 }}>
        <div style={{ width: 96, height: 96, margin: '0 auto', borderRadius: 26, background: `${VIDEO_COLORS.accent}22`, border: `1px solid ${VIDEO_COLORS.accent}66`, display: 'grid', placeItems: 'center' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: VIDEO_COLORS.accent, boxShadow: `0 0 40px ${VIDEO_COLORS.accent}` }} />
        </div>
        <Brand text={brand} size={78} />
        <div style={{ fontSize: 52, fontWeight: 640, color: VIDEO_COLORS.text, letterSpacing: -1 }}>{subtitle}</div>
        <div style={{ fontSize: 36, color: VIDEO_COLORS.dim }}>{count} Tools · 1 Klick</div>
      </div>
    </AbsoluteFill>
  );
};

const CardScene9x16: React.FC<{ bm: VideoBookmark; index: number; total: number }> = ({ bm, index, total }) => {
  const frame = useCurrentFrame();
  const fade = useFadeOut(PER_BOOKMARK_FRAMES);
  const card = useSpringIn(CARD_STAGGER[0]);
  const meta = useSpringIn(CARD_STAGGER[1]);
  const tags = useSpringIn(CARD_STAGGER[2]);
  const color = clickerColor(bm.clicker);
  const progress = interpolate(frame, [0, PER_BOOKMARK_FRAMES], [0, 1]);

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {/* vertikaler Fortschritt (TikTok-Stil) */}
      <div style={{ position: 'absolute', right: 44, top: 180, bottom: 320, width: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 6 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${progress * 100}%`, background: color, borderRadius: 6, boxShadow: `0 0 18px ${color}` }} />
      </div>
      <div style={{ position: 'absolute', top: 120, left: 64 }}>
        <span style={{ fontSize: 34, color: VIDEO_COLORS.dim }}>{index + 1} / {total}</span>
      </div>

      <AbsoluteFill style={{ justifyContent: 'center', padding: 84 }}>
        <div
          style={{
            transform: `translateY(${card.translateY}px) scale(${card.scale})`,
            opacity: card.opacity,
            display: 'flex',
            flexDirection: 'column',
            gap: 44,
            padding: '76px 64px',
            borderRadius: 40,
            border: `1px solid ${VIDEO_COLORS.border}`,
            background: VIDEO_COLORS.surface,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', opacity: meta.opacity, transform: `translateY(${meta.translateY}px)` }}>
            <StatusChip clicker={bm.clicker} scale={1.7} />
          </div>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -2, lineHeight: 1.08, color: VIDEO_COLORS.text, textAlign: 'center' }}>
            {bm.title.slice(0, 34)}
          </div>
          {bm.host && (
            <div style={{ fontFamily: 'Consolas, monospace', fontSize: 38, color: VIDEO_COLORS.dim, textAlign: 'center' }}>{bm.host}</div>
          )}
          {bm.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', opacity: tags.opacity, transform: `translateY(${tags.translateY}px)` }}>
              {bm.tags.slice(0, 4).map((t) => (
                <span key={t} style={{ padding: '13px 30px', borderRadius: 999, border: `1px solid ${color}40`, background: `${color}10`, fontSize: 34, color: VIDEO_COLORS.dim }}>
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

const Outro9x16: React.FC<{ brand: string }> = ({ brand }) => {
  const { scale, opacity } = useSpringIn(4);
  const fade = useFadeOut(OUTRO_FRAMES);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: fade }}>
      <div style={{ textAlign: 'center', transform: `scale(${scale})`, opacity, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <Brand text={brand} size={92} />
        <div style={{ fontSize: 40, color: VIDEO_COLORS.dim }}>Folgen für mehr Tools ⚡</div>
      </div>
    </AbsoluteFill>
  );
};
