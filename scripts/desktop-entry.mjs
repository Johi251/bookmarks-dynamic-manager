import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const entry = `desktop-${version}.html`;
assert.equal(config.app.windows[0].url, entry, 'Desktop-Einstieg muss zur Paketversion passen.');
writeFileSync(`dist-desktop/${entry}`, readFileSync('dist-desktop/index.html'));
