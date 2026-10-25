import { Config } from '@remotion/cli/config';

/**
 * Remotion-Konfiguration der Video-Engine.
 * Einstieg: video/src/index.ts (beide Templates registriert).
 * Render: bun run render:video <props.json> [composition] [out.mp4]
 */
Config.setEntryPoint('./video/src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(null); // alle Kerne
Config.setOverwriteOutput(true);
