import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const {version}=JSON.parse(readFileSync('package.json','utf8'));
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
  const id='bookmarks-dynamic-manager@johi251.github.io';
  const created = await call('/session',{capabilities:{alwaysMatch:{browserName:'firefox','moz:firefoxOptions':{args:['-headless']}}}});
  session=created.sessionId;
  const installed=await call(`/session/${session}/moz/addon/install`,{addon:readFileSync(`releases/v${version}/bookmarks-dynamic-manager-firefox.zip`).toString('base64'),temporary:true});
  assert.equal(installed,id);
  // WebDriver untersagt Navigation zu moz-extension; keine Browser-Schutzregel umgehen.
  console.log(`PASS: Firefox ${created.capabilities.browserVersion} installiert das echte ZIP temporär mit der erwarteten Add-on-ID. Fensterbedienung bleibt separat zu prüfen.`);
} finally {
  if(session) await call(`/session/${session}`,undefined,'DELETE').catch(()=>undefined);
  driver.kill();
}
