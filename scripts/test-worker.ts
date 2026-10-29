import { expect, test } from 'bun:test';

test('Vision liest den separaten Schlüssel auch ohne localStorage im Service Worker', () => {
  const script = `
    const bag = {}; let calls = 0;
    globalThis.chrome = {storage:{local:{get:async()=>bag,set:async(items)=>Object.assign(bag,items),remove:async(k)=>{delete bag[k]}}}};
    globalThis.fetch = async()=>{calls++;return Response.json({choices:[{message:{content:JSON.stringify({tags:['visual'],categories:['Design']})}}]})};
    const {setAiApiKey}=await import('./src/storage.ts');
    const {analyzeScreenshot}=await import('./src/ai/vision.ts');
    await setAiApiKey('synthetic-test-value');
    const result=await analyzeScreenshot('data:image/jpeg;base64,AA==',{url:'https://example.com',title:'Test',existingTags:[]},{aiProvider:'api',aiEndpoint:'https://dummy.invalid/v1',visionModel:'test'},[]);
    if(result.used!=='vision'||calls!==1)process.exit(1);
  `;
  const result = Bun.spawnSync([process.execPath, 'run', '-'], {stdin:new TextEncoder().encode(script),stdout:'pipe',stderr:'pipe',cwd:process.cwd()});
  expect(result.exitCode).toBe(0);
});
