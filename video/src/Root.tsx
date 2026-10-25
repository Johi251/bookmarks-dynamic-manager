import React from 'react';
import { Composition } from 'remotion';
import { Walkthrough16x9 } from '../../src/video/Walkthrough16x9';
import { Short9x16 } from '../../src/video/Short9x16';
import { videoDurationFrames, VIDEO_FPS, type VideoProps } from '../../src/video/types';

/**
 * Remotion-Root: registriert beide Timeline-Templates für Studio & CLI-Render.
 *   Template A — Walkthrough16x9 (1920×1080, YouTube/JayTX)
 *   Template B — Short9x16 (1080×1920, TikTok/Shorts/ROFLnator.90)
 * Dauer wird aus der Lesezeichen-Anzahl berechnet (calculateMetadata).
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Walkthrough16x9"
        component={Walkthrough16x9}
        durationInFrames={300}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
        defaultProps={{ brand: 'Bookmarks Dynamic Manager', subtitle: 'Werkzeugkasten-Walkthrough', bookmarks: [] }}
        calculateMetadata={({ props }: { props: VideoProps }) => ({
          durationInFrames: videoDurationFrames(props.bookmarks.length),
        })}
      />
      <Composition
        id="Short9x16"
        component={Short9x16}
        durationInFrames={300}
        fps={VIDEO_FPS}
        width={1080}
        height={1920}
        defaultProps={{ brand: 'Bookmarks Dynamic Manager', subtitle: 'Top-Tools der Woche', bookmarks: [] }}
        calculateMetadata={({ props }: { props: VideoProps }) => ({
          durationInFrames: videoDurationFrames(props.bookmarks.length),
        })}
      />
    </>
  );
};
