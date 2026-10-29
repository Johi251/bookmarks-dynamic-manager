import { test, expect } from 'bun:test';
import { parseHTML } from 'linkedom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createSeedState } from '../src/rules';

test('Oberfläche: Statistik, sechs Schnellzugriffe und Mehrfachauswahl sind erreichbar', async () => {
  const {window, document} = parseHTML('<html><body><div id="root"></div></body></html>');
  Object.assign(globalThis, {window, document, HTMLElement:window.HTMLElement, IS_REACT_ACT_ENVIRONMENT:true});
  window.location = new URL('http://127.0.0.1:4179/bookmarks-dynamic-manager/') as never;
  window.matchMedia = (() => ({matches:false,addEventListener(){},removeEventListener(){}})) as never;
  const state = createSeedState();
  state.settings.autoBackup = false; state.settings.clickerEnabled = false; state.settings.faviconsEnabled = false;
  state.bookmarks = [{id:'test',url:'https://example.com/test',title:'Synthetischer UI-Test',added:1,tags:[],categoryIds:[],pinned:false}];
  const data = new Map([['bdm-state-v1',JSON.stringify(state)]]);
  let acknowledged = false;
  (window as any).__TAURI__ = {core:{invoke:async(command:string)=>{
    if(command==='hunt_pending') return {items:acknowledged?[]:[{id:'hunt-test',title:'copyNpaste-Test',url:'https://example.com/from-clipboard'}],status:'Testempfang'};
    if(command==='hunt_ack') {
      expect(JSON.parse(data.get('bdm-state-v1')!).bookmarks.some((b:any)=>b.url==='https://example.com/from-clipboard')).toBe(true);
      acknowledged=true; return;
    }
  }}};
  globalThis.localStorage = {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}} as Storage;
  const {default:App} = await import('../src/App');
  const root = createRoot(document.getElementById('root')!);
  const click = async (text:string) => {
    const button = [...document.querySelectorAll('button')].find((b)=>b.textContent===text);
    expect(button).toBeDefined();
    await act(async()=>{button!.click();});
  };
  try {
    await act(async()=>{root.render(<App/>);await new Promise((r)=>setTimeout(r,10));});
    expect(document.body.textContent).toContain('Synthetischer UI-Test');
    expect(document.body.textContent).toContain('copyNpaste-Test');
    expect(acknowledged).toBe(true);
    await act(async()=>{(document.querySelector('[aria-label="Schnellwahl"]') as HTMLElement).click();});
    expect(document.querySelectorAll('.orbit-item')).toHaveLength(6);
    await click('Statistik');
    expect(document.querySelector('[aria-label="Statistik"]')).not.toBeNull();
    await click('Lesezeichen');
    await click('Mehrere auswählen');
    expect(document.querySelector('input[type="checkbox"]')).not.toBeNull();
    await click('Sichtbare auswählen');
    const pin = [...document.querySelectorAll('button')].find((b)=>b.textContent==='Anpinnen')!;
    expect(pin.hasAttribute('disabled')).toBe(false);
    await act(async()=>{pin.click();});
    expect(JSON.parse(data.get('bdm-state-v1')!).bookmarks.every((b:any)=>b.pinned)).toBe(true);
    await click('Rückgängig');
    expect(JSON.parse(data.get('bdm-state-v1')!).bookmarks.every((b:any)=>!b.pinned)).toBe(true);
  } finally { await act(async()=>{root.unmount();}); }
});
