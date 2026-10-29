import { createServer } from 'node:http';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fixtureTitle = 'Synthetischer Add-on-Test';
const server = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(`<title>${fixtureTitle}</title><p>Lokale Testseite</p>`); });
await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
const url = `http://127.0.0.1:${server.address().port}/bookmark`;
const extension = resolve('.data/browser-addon');
let context;
try {
  context = await chromium.launchPersistentContext('', {channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  let [worker] = context.serviceWorkers();
  worker ||= await context.waitForEvent('serviceworker');
  const id = worker.url().split('/')[2];
  assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().version), '1.4.0');
  const manager = await context.newPage();
  const errors = [];
  manager.on('pageerror', (error) => errors.push(error.message));
  await manager.goto(`chrome-extension://${id}/manager.html`);
  await manager.getByRole('tab', {name:'Statistik',exact:true}).waitFor();
  const [fixture] = await Promise.all([context.waitForEvent('page'),worker.evaluate((target) => chrome.tabs.create({url:target,active:true}),url)]);
  await fixture.waitForLoadState('domcontentloaded');
  const saved = await manager.evaluate(() => chrome.runtime.sendMessage({type:'BDM_SAVE_CURRENT'}));
  assert.equal(saved.ok, true);
  await manager.getByText(fixtureTitle, {exact:true}).first().waitFor();
  const duplicate = await manager.evaluate(() => chrome.runtime.sendMessage({type:'BDM_SAVE_CURRENT'}));
  assert.equal(duplicate.reason, 'duplicate');
  await manager.reload();
  await manager.getByText(fixtureTitle, {exact:true}).first().waitFor();
  await manager.getByRole('tab', {name:'Statistik',exact:true}).click();
  await manager.getByRole('region', {name:'Statistik',exact:true}).waitFor();
  await manager.getByRole('button', {name:'Schnellwahl',exact:true}).click();
  assert.equal(await manager.getByRole('group', {name:'Sechs Schnellzugriffe'}).getByRole('button').count(), 6);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.getByRole('link', {name:fixtureTitle,exact:true}).waitFor();
  const [opened] = await Promise.all([context.waitForEvent('page'),popup.locator('#openManager').click()]);
  await opened.waitForLoadState('domcontentloaded');
  assert.ok(opened.url().endsWith('/manager.html'));
  assert.deepEqual(errors, []);
  console.log('PASS: Echtes Chromium lädt ZIP-Add-on und Service Worker; Speichern, Dubletten, dauerhafter Speicher, Statistik, sechs Schnellaktionen, Popup und Manager-Link funktionieren.');
} finally {
  await context?.close();
  await new Promise((done) => server.close(done));
}
