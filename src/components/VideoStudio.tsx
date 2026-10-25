import { useEffect, useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import type { BookmarksApi } from '../hooks/useBookmarks';
import { Walkthrough16x9 } from '../video/Walkthrough16x9';
import { Short9x16 } from '../video/Short9x16';
import { clampBookmarks, videoDurationFrames, VIDEO_FPS, type VideoBookmark } from '../video/types';
import { downloadFile } from '../exporter';
import { hostOf } from '../host';
import Icon from './Icon';

interface Props {
  api: BookmarksApi;
  onClose: () => void;
  notify: (text: string, kind?: 'ok' | 'info' | 'warn', detail?: string) => void;
}

type Format = 'walkthrough' | 'short';

/**
 * Video-Studio: Lesezeichen-Auswahl als animierte Präsentation in zwei
 * Remotion-Timeline-Templates — A: 16:9 Walkthrough (YouTube/JayTX),
 * B: 9:16 Short (TikTok/Shorts/ROFLnator.90). Live-Vorschau per
 * @remotion/player; das Rendern als MP4 läuft über die mitgelieferte
 * Render-Pipeline (`bun run render:video` mit exportierter Auswahl).
 */
export default function VideoStudio({ api, onClose, notify }: Props) {
  const [format, setFormat] = useState<Format>('walkthrough');
  const [scope, setScope] = useState<'top' | 'pinned' | 'online' | 'local'>('top');
  const [max, setMax] = useState(8);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const bookmarks = api.state.bookmarks;
  const selection = useMemo(() => {
    let list = [...bookmarks].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.added - a.added);
    if (scope === 'pinned') list = list.filter((b) => b.pinned);
    if (scope === 'online') list = list.filter((b) => b.clicker?.status === 'online');
    if (scope === 'local') list = list.filter((b) => b.clicker?.status === 'local');
    return list.slice(0, max);
  }, [bookmarks, scope, max]);

  const videoBookmarks: VideoBookmark[] = clampBookmarks(
    selection.map((b) => ({
      title: b.title,
      host: hostOf(b.url),
      tags: b.tags.slice(0, 5),
      clicker: b.clicker?.status === 'online' || b.clicker?.status === 'local' || b.clicker?.status === 'checking' ? b.clicker.status : undefined,
    }))
  );

  const durationInFrames = videoDurationFrames(videoBookmarks.length);
  const isWide = format === 'walkthrough';
  const brand = 'Bookmarks Dynamic Manager';
  const subtitle = isWide ? 'Werkzeugkasten-Walkthrough' : 'Top-Tools der Woche';

  const exportProps = () => {
    const props = { brand, subtitle, bookmarks: videoBookmarks };
    downloadFile(
      `bdm-video-${format}-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ composition: isWide ? 'Walkthrough16x9' : 'Short9x16', props }, null, 2),
      'application/json'
    );
    notify('Video-Requisiten exportiert', 'ok', `Rendern mit: bun run render:video props.json`);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide video-studio" role="dialog" aria-label="Video-Studio">
        <h2>
          <Icon name="film" size={17} /> Video-Studio — Remotion-Templates
        </h2>

        <div className="vs-controls">
          <div className="tabs">
            <button className={isWide ? 'active' : ''} onClick={() => setFormat('walkthrough')}>
              Template A · 16:9 (YouTube)
            </button>
            <button className={!isWide ? 'active' : ''} onClick={() => setFormat('short')}>
              Template B · 9:16 (Shorts/TikTok)
            </button>
          </div>
          <div className="vs-row">
            <label>
              Auswahl
              <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
                <option value="top">Top (angepinnt zuerst)</option>
                <option value="pinned">Nur Angepinnte</option>
                <option value="online">1Clicker · Online (🟢)</option>
                <option value="local">1Clicker · Lokal (🔵)</option>
              </select>
            </label>
            <label>
              Anzahl ({max})
              <input type="range" min={3} max={24} value={max} onChange={(e) => setMax(Number(e.target.value))} />
            </label>
          </div>
        </div>

        <div className={`vs-stage ${isWide ? 'wide' : 'tall'}`}>
          <Player
            component={isWide ? Walkthrough16x9 : Short9x16}
            inputProps={{ bookmarks: videoBookmarks, brand, subtitle }}
            durationInFrames={durationInFrames}
            fps={VIDEO_FPS}
            compositionWidth={isWide ? 1920 : 1080}
            compositionHeight={isWide ? 1080 : 1920}
            style={{ width: '100%', height: '100%', borderRadius: 14, overflow: 'hidden' }}
            controls
            loop
            autoPlay
          />
        </div>

        <p className="hint">
          {videoBookmarks.length} Lesezeichen · {(durationInFrames / VIDEO_FPS).toFixed(1)} s · Vorschau = exakte Render-Vorschau (30 fps).
          Für MP4 die Requisiten exportieren und mit der Render-Pipeline kompilieren.
        </p>

        <div className="modal-actions">
          <button className="btn" onClick={exportProps}>
            <Icon name="download" size={14} /> Requisiten-JSON
          </button>
          <button className="btn primary" onClick={onClose}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
