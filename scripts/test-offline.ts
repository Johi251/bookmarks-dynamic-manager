import { expect, test } from 'bun:test';
import { prepareOffline } from '../src/offline';

test('Desktop entfernt alte Worker und lädt vor dem Rendern neu; Web behält Offline-Funktion', async () => {
  const old = Object.fromEntries(['navigator', 'window', 'location'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let removed = 0, reloaded = 0, registered = 0;
  const sw = {controller:{},getRegistrations:async()=>[{unregister:async()=>{removed++;return true;}}],register:async()=>{registered++;}};
  try {
    Object.defineProperty(globalThis,'navigator',{value:{serviceWorker:sw},configurable:true});
    Object.defineProperty(globalThis,'window',{value:{__TAURI_INTERNALS__:{},addEventListener:(_name:string,callback:()=>void)=>callback()},configurable:true});
    Object.defineProperty(globalThis,'location',{value:{hostname:'tauri.localhost',protocol:'http:',reload:()=>{reloaded++;}},configurable:true});
    expect(await prepareOffline(true)).toBe(false);
    expect([removed,reloaded,registered]).toEqual([1,1,0]);
    sw.controller = null as never;
    expect(await prepareOffline(true)).toBe(true);
    expect([removed,reloaded,registered]).toEqual([2,1,0]);
    Object.defineProperty(globalThis,'window',{value:{addEventListener:(_name:string,callback:()=>void)=>callback()},configurable:true});
    Object.defineProperty(globalThis,'location',{value:{hostname:'example.com',protocol:'https:'},configurable:true});
    expect(await prepareOffline(true)).toBe(true);
    expect(registered).toBe(1);
  } finally {
    for(const key of ['navigator','window','location']) {
      if(old[key]) Object.defineProperty(globalThis,key,old[key]!);
      else Reflect.deleteProperty(globalThis,key);
    }
  }
});
