/**
 * Packt das gebaute Add-on (dist-ext) in zwei ZIPs:
 * - bookmarks-dynamic-manager-chrome.zip  (Chrome/Brave/Edge, MV3-Service-Worker)
 * - bookmarks-dynamic-manager-firefox.zip (Firefox, background.scripts + gecko-id)
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist-ext');
const OUT = join(ROOT, 'releases');

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dest, entry);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

function zipDir(dir, zipPath) {
  execFileSync('powershell', [
    '-NoProfile', '-Command',
    `Compress-Archive -Path '${dir}\\*' -DestinationPath '${zipPath}' -Force`,
  ]);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Chrome/Brave/Edge: manifest.json (Standard-Manifest) + Icons hineinkopieren.
const chromeDir = join(OUT, 'ext-chrome');
copyDir(DIST, chromeDir);
copyDir(join(ROOT, 'extension/icons'), join(chromeDir, 'icons'));
copyFileSync(join(ROOT, 'extension/manifest.json'), join(chromeDir, 'manifest.json'));
zipDir(chromeDir, join(OUT, 'bookmarks-dynamic-manager-chrome.zip'));

// Firefox: gleiche Dateien, aber Firefox-Manifest.
const ffDir = join(OUT, 'ext-firefox');
copyDir(chromeDir, ffDir);
writeFileSync(join(ffDir, 'manifest.json'), readFileSync(join(ROOT, 'extension/manifest.firefox.json'), 'utf-8'));
zipDir(ffDir, join(OUT, 'bookmarks-dynamic-manager-firefox.zip'));

console.log('ZIPs erstellt in', OUT);
