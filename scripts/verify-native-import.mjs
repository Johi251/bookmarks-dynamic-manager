import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { verifyImport } from './verify-import.mjs';

assert.equal(process.env.CI,'true','Diese Prüfung verwendet ausschließlich einen isolierten CI-Rechner.');
assert.equal(process.platform,'win32');
const { chromium } = await import(pathToFileURL(join(process.env.RUNNER_TEMP,'bdm-browser-runtime/node_modules/playwright/index.mjs')).href);
const driverPath=process.env.EDGEWEBDRIVER?join(process.env.EDGEWEBDRIVER,'msedgedriver.exe'):'msedgedriver.exe';
const driver=spawn(driverPath,['--port=4445'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let session, browser, log='', launchError;
driver.on('error',(error)=>{launchError=error;});
for(const stream of [driver.stdout,driver.stderr]) stream.on('data',(chunk)=>{log=(log+chunk).slice(-4000);});
const call=async(path,body,method=body===undefined?'GET':'POST')=>{
  const response=await fetch(`http://127.0.0.1:4445${path}`,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  const result=await response.json();
  if(!response.ok||result.value?.error) throw new Error(JSON.stringify(result.value));
  return result.value;
};
try {
  let ready=false;
  for(let attempt=0;attempt<60;attempt++){
    if(launchError) throw launchError;
    try{ready=!!(await call('/status')).ready;}catch{ /* Treiber startet. */ }
    if(ready)break;
    await new Promise((resolve)=>setTimeout(resolve,500));
  }
  assert.ok(ready,`Microsoft Edge WebDriver startet nicht: ${log}`);
  const created=await call('/session',{capabilities:{alwaysMatch:{browserName:'webview2','ms:edgeOptions':{
    binary:resolve('src-tauri/target/release/BookmarksDynamicManager.exe'),
    webviewOptions:{userDataFolder:join(process.env.RUNNER_TEMP,'bdm-native-import-profile')}
  }}}});
  session=created.sessionId;
  const address=created.capabilities['ms:edgeOptions']?.debuggerAddress;
  assert.ok(address,`WebView-Debugadresse fehlt: ${JSON.stringify(created.capabilities)}`);
  browser=await chromium.connectOverCDP(`http://${address}`);
  const context=browser.contexts()[0];
  const page=context.pages()[0]||await context.waitForEvent('page');
  await page.waitForURL(/tauri\.localhost/);
  await verifyImport(page);
  console.log('PASS: Import-Dateiauswahl und HTML5-Drop in der tatsächlich gebauten Windows-App geprüft.');
} finally {
  await browser?.close();
  if(session) await call(`/session/${session}`,undefined,'DELETE').catch(()=>undefined);
  if(driver.exitCode===null){driver.kill();await once(driver,'exit');}
}
