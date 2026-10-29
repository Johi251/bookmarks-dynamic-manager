import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { verifyImport } from './verify-import.mjs';

assert.equal(process.env.CI,'true','Diese Prüfung verwendet ausschließlich einen isolierten CI-Rechner.');
assert.equal(process.platform,'win32');
const { chromium } = await import(pathToFileURL(join(process.env.RUNNER_TEMP,'bdm-browser-runtime/node_modules/playwright/index.mjs')).href);
const child=spawn('src-tauri/target/release/BookmarksDynamicManager.exe',[],{windowsHide:true,stdio:'ignore',env:{...process.env,
  WEBVIEW2_USER_DATA_FOLDER:join(process.env.RUNNER_TEMP,'bdm-native-import-profile'),
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-address=127.0.0.1 --remote-debugging-port=9223'}});
let browser;
try {
  for(let attempt=0;attempt<60;attempt++) {
    try {browser=await chromium.connectOverCDP('http://127.0.0.1:9223',{timeout:1000});break;} catch {await new Promise((resolve)=>setTimeout(resolve,500));}
  }
  assert.ok(browser,'Windows-WebView ist nicht bereit.');
  const context=browser.contexts()[0];
  const page=context.pages()[0] || await context.waitForEvent('page');
  await page.waitForURL(/tauri\.localhost/);
  await verifyImport(page);
  console.log('PASS: Import-Dateiauswahl und HTML5-Drop in der tatsächlich gebauten Windows-App geprüft.');
} finally {
  await browser?.close();
  if(child.exitCode===null) {child.kill();await once(child,'exit');}
}
