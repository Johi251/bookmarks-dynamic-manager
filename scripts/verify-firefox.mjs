import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const driver = spawn('geckodriver', ['--host','127.0.0.1','--port','4444'], {stdio:['ignore','pipe','pipe']});
let log = '', session;
for (const stream of [driver.stdout,driver.stderr]) stream.on('data',(chunk)=>{log=(log+chunk).slice(-4000);});
const call = async (path, body, method=body===undefined?'GET':'POST') => {
  const response = await fetch(`http://127.0.0.1:4444${path}`, {method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  const result = await response.json();
  if (!response.ok || result.value?.error) throw new Error(JSON.stringify(result.value));
  return result.value;
};
try {
  let ready = false;
  for(let attempt=0;attempt<40;attempt++) {
    try { ready=!!(await call('/status')).ready; } catch { /* Treiber startet noch. */ }
    if(ready) break;
    await new Promise((resolve)=>setTimeout(resolve,250));
  }
  assert.ok(ready, `Geckodriver startet nicht: ${log}`);
  const id='bookmarks-dynamic-manager@johi251.github.io', uuid=randomUUID();
  const created = await call('/session',{capabilities:{alwaysMatch:{browserName:'firefox','moz:firefoxOptions':{args:['-headless'],prefs:{'extensions.webextensions.uuids':JSON.stringify({[id]:uuid})}}}}});
  session=created.sessionId;
  const installed=await call(`/session/${session}/moz/addon/install`,{addon:readFileSync('releases/v1.4.0/bookmarks-dynamic-manager-firefox.zip').toString('base64'),temporary:true});
  assert.equal(installed,id);
  await call(`/session/${session}/url`,{url:`moz-extension://${uuid}/manager.html`});
  let text='';
  for(let attempt=0;attempt<40;attempt++) {
    text=await call(`/session/${session}/execute/sync`,{script:'return document.body.innerText',args:[]});
    if(text.includes('Statistik')&&text.includes('1.4.0')) break;
    await new Promise((resolve)=>setTimeout(resolve,250));
  }
  assert.ok(text.includes('Statistik')&&text.includes('1.4.0'),'Firefox-Manager lädt nicht vollständig.');
  console.log(`PASS: Firefox ${created.capabilities.browserVersion} installiert das echte ZIP temporär und lädt den Manager 1.4.0 mit Statistik.`);
} finally {
  if(session) await call(`/session/${session}`,undefined,'DELETE').catch(()=>undefined);
  driver.kill();
}
