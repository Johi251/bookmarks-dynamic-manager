import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { directoryFiles, zipFiles } from './zip.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const release = join(root, 'releases', `v${version}`), files = [];
for (const folder of ['src', 'extension', 'public', 'scripts', 'video', '.github']) files.push(...directoryFiles(join(root, folder), `Quellcode/${folder}/`));
for (const folder of ['src', 'icons']) files.push(...directoryFiles(join(root, 'src-tauri', folder), `Quellcode/src-tauri/${folder}/`));
for (const name of ['package.json', 'bun.lock', 'tsconfig.json', 'vite.config.ts', 'vite.config.ext.ts', 'index.html', 'README.md', 'ARCHITEKTUR.md', 'UEBERGABE-1.4.0.md', 'PRUEFSTATUS-1.4.0.md', '.gitignore', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock', 'src-tauri/build.rs', 'src-tauri/tauri.conf.json']) files.push({name:`Quellcode/${name}`,data:readFileSync(join(root,name))});
files.push(...directoryFiles(join(root, 'dist-web'), 'Web-App/'));
for (const name of ['BookmarksDynamicManager.exe', `Bookmarks.Dynamic.Manager_${version}_x64-setup.exe`, 'bookmarks-dynamic-manager-chrome.zip', 'bookmarks-dynamic-manager-firefox.zip']) {
  const built = name === 'BookmarksDynamicManager.exe' ? join(root, 'src-tauri/target/release', name) : name.endsWith('-setup.exe') ? join(root, 'src-tauri/target/release/bundle/nsis', `Bookmarks Dynamic Manager_${version}_x64-setup.exe`) : join(release, name);
  const path = existsSync(join(release, name)) ? join(release, name) : built;
  if (!existsSync(path)) throw new Error(`Auslieferung fehlt: ${name}`);
  files.push({name:`Downloads/${name}`,data:readFileSync(path)});
}
files.push({name:'START-HIER.md',data:readFileSync(join(root, 'UEBERGABE-1.4.0.md'))});
zipFiles(files, join(release, `Bookmarks-Dynamic-Manager-${version}-Gesamtpaket.zip`));
