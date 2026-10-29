import { readdirSync, existsSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = process.env.RELEASE_TAG || `v${version}`;
if (tag !== `v${version}`) throw new Error('Release und Paketversion stimmen nicht überein.');
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const files = walk('src-tauri/target/release/bundle').filter((p) => basename(p).includes(`_${version}_`) && /\.(exe|msi|dmg|deb|AppImage|rpm)$/.test(p));
const portable = 'src-tauri/target/release/BookmarksDynamicManager.exe';
if (process.platform === 'win32' && existsSync(portable)) files.push(portable);
if (!files.length) throw new Error('Kein natives Paket erzeugt.');
if (process.argv.includes('--list')) {
  console.log(files.join('\n'));
} else {
  const output = join('releases', tag);
  mkdirSync(output, { recursive: true });
  for (const source of files) {
    if (!basename(source).includes(version) && source !== portable) throw new Error('Fremde Paketversion im Build-Verzeichnis.');
    const target = join(output, basename(source).replaceAll(' ', '.'));
    copyFileSync(source, target);
    const uploaded = spawnSync('gh', ['release', 'upload', tag, target, '--clobber'], { stdio: 'inherit', shell: false });
    if (uploaded.error) throw uploaded.error;
    if (uploaded.status !== 0) process.exit(uploaded.status || 1);
  }
}
