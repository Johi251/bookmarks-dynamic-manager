import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const suffix = process.platform === 'win32' ? '.exe' : '';
const binary = ['BookmarksDynamicManager', 'bookmarks-dynamic-manager'].map((name) => join('src-tauri', 'target', 'release', name + suffix)).find(existsSync);
assert.ok(binary, 'Gebautes natives Programm fehlt.');
const dataRoot = process.platform === 'win32' ? process.env.LOCALAPPDATA : process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support') : (process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'));
assert.ok(dataRoot, 'Lokales Datenverzeichnis fehlt.');
const inbox = join(dataRoot, 'io.github.johi251.bookmarks-dynamic-manager', 'todays-hunt.json');
const child = spawn(binary, [], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '', launchError;
child.on('error', (error) => { launchError = error; });
for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { log = (log + chunk).slice(-4000); });
const waitFor = async (check) => {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (launchError || child.exitCode !== null) throw new Error(`Native App beendet: ${launchError || child.exitCode}\n${log}`);
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Native Start-/Speicherprüfung überschritten.\n${log}`);
};
const send = (payload) => fetch('http://127.0.0.1:9911/api/todays-hunt', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(2000)});
try {
  await waitFor(async () => { try { return (await send({source:'copyNpaste',probe:true})).ok; } catch { return false; } });
  const url = 'https://example.com/bdm-native-smoke';
  assert.ok((await send({source:'copyNpaste',url,capturedAt:new Date().toISOString()})).ok);
  await waitFor(async () => existsSync(inbox) && !JSON.parse(readFileSync(inbox,'utf8')).some((item) => item.url === url));
  console.log('PASS: Native App startet; echter HTTP-Eingang wird nach Speicherung über native IPC quittiert.');
} finally { child.kill(); }
