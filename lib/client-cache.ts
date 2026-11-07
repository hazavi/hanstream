import { isDesktop, nativeInvoke } from './native';

export type CacheRecord = { key: string; value: unknown; expires: number; savedAt: number };
function transient(key: string) {
  try { return /^\/api\/(?:episode(?:\/|$)|search(?:\/|$))/.test(new URL(key, 'https://cache.invalid').pathname); }
  catch { return true; }
}
let database: Promise<IDBDatabase | undefined> | undefined;
function open() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(undefined);
  return database ||= new Promise<IDBDatabase | undefined>(resolve => {
    const request = indexedDB.open('hanstream-content-cache');
    request.onupgradeneeded = () => request.result.createObjectStore('responses', {keyPath:'key'});
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); database = undefined; }; resolve(request.result); };
    request.onerror = () => { database = undefined; resolve(undefined); };
    request.onblocked = () => resolve(undefined);
  });
}

export async function readLocalResponse(key: string): Promise<CacheRecord | undefined> {
  if (transient(key)) return undefined;
  try {
    if (isDesktop()) return (await nativeInvoke<CacheRecord | null>('cache_load', {key})) || undefined;
    const db = await open();
    if (!db) return undefined;
    return await new Promise(resolve => {
      const request = db.transaction('responses').objectStore('responses').get(key);
      request.onsuccess = () => resolve(request.result?.expires > Date.now() ? request.result : undefined);
      request.onerror = () => resolve(undefined);
    });
  } catch { return undefined; }
}

export async function storeLocalResponse(record: CacheRecord) {
  try {
    if (transient(record.key) || record.key.length > 4096 || !Number.isFinite(record.expires) || record.expires <= Date.now() || record.expires > Date.now() + 86_400_000 || new TextEncoder().encode(JSON.stringify(record)).byteLength > 2_000_000) return;
    if (isDesktop()) { await nativeInvoke('cache_save', {key:record.key,value:record,expiresAt:record.expires}); return; }
    const db = await open();
    if (!db) return;
    await new Promise<void>(resolve => {
      const transaction = db.transaction('responses','readwrite');
      const store = transaction.objectStore('responses');
      store.put(record);
      const cursor = store.openCursor();
      const records: {key:IDBValidKey;savedAt:number;size:number}[] = [];
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (item) {
          if (item.value.expires <= Date.now()) item.delete();
          else records.push({key:item.primaryKey,savedAt:item.value.savedAt,size:JSON.stringify(item.value).length});
          item.continue();
        } else {
          records.sort((a,b)=>a.savedAt-b.savedAt);
          let size = records.reduce((sum,item)=>sum+item.size,0);
          while (records.length>50 || size>10_000_000) { const first=records.shift(); if(!first)break; store.delete(first.key); size-=first.size; }
        }
      };
      transaction.oncomplete = transaction.onerror = transaction.onabort = () => resolve();
    });
  } catch { /* Cache availability never blocks the current page. */ }
}
