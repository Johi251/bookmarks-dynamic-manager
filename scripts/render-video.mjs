/**
 * Render-Pipeline der Remotion-Video-Engine (lokales Kompilieren zu MP4):
 *
 *   bun run render:video props.json                → rendert die im JSON genannte Komposition
 *   bun run render:video props.json Short9x16 out.mp4
 *
 * props.json = „Requisiten-Export" aus dem Video-Studio der App
 * ({ composition: "Walkthrough16x9" | "Short9x16", props: { brand, subtitle, bookmarks } }).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Verwendung: bun run render:video <props.json> [composition] [out.mp4]');
  process.exit(1);
}

const propsPath = resolve(args[0]);
const parsed = JSON.parse(readFileSync(propsPath, 'utf-8'));
const compositionId = args[1] ?? parsed.composition ?? 'Walkthrough16x9';
const outFile = args[2] ?? `out/${compositionId}-${basename(propsPath, '.json')}.mp4`;

const inputProps = parsed.props ?? parsed; // auch nackte props akzeptieren

console.log(`Bündle Remotion-Projekt (entry video/src/index.ts) …`);
const bundleLocation = await bundle({
  entryPoint: resolve('video/src/index.ts'),
  onProgress: (p) => process.stdout.write(`\rBundling … ${p}%   `),
});
process.stdout.write('\n');

console.log(`Wähle Komposition „${compositionId}" …`);
const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: compositionId,
  inputProps,
});

mkdirSync(dirname(outFile), { recursive: true });
console.log(`Rendere ${composition.durationInFrames} Frames → ${outFile} …`);
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: 'h264',
  outputLocation: outFile,
  inputProps,
});

console.log(`Fertig: ${outFile}`);
writeFileSync(outFile + '.meta.json', JSON.stringify({ compositionId, durationInFrames: composition.durationInFrames, width: composition.width, height: composition.height, date: new Date().toISOString() }, null, 2));

function dirname(p) {
  const parts = p.replace(/\\/g, '/').split('/');
  parts.pop();
  return parts.join('/') || '.';
}
