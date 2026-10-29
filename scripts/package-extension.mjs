import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { directoryFiles, zipFiles } from './zip.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const files = [...directoryFiles(join(root, 'dist-ext')), ...directoryFiles(join(root, 'extension/icons'), 'icons/')];
for (const browser of ['chrome', 'firefox']) {
  const manifest = readFileSync(join(root, 'extension', browser === 'chrome' ? 'manifest.json' : 'manifest.firefox.json'));
  zipFiles([...files, { name: 'manifest.json', data: manifest }], join(root, 'releases', `v${version}`, `bookmarks-dynamic-manager-${browser}.zip`));
}
