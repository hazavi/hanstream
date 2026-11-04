// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { clearHtmlCache, readHtml } from '../lib/html';
vi.mock('undici', async original => ({ ...(await original<typeof import('undici')>()), fetch: (...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args) }));
afterEach(()=>{clearHtmlCache();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers();});
it('cools down a connect-timeout host immediately without retry storms or raw errors',async()=>{
  const error=Object.assign(new TypeError('fetch failed'),{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}});
  const fetch=vi.fn().mockRejectedValue(error);
  vi.stubGlobal('fetch',fetch);
  await expect(readHtml('https://metadata.example/actor',3600,100)).rejects.toThrow('Catalog is temporarily unavailable');
  await expect(readHtml('https://metadata.example/other')).rejects.toThrow('Catalog is temporarily unavailable');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1]).toMatchObject({cache:'no-store',signal:expect.any(AbortSignal)});
});
it('coalesces HTML reads, reuses results, and preserves old data during an outage',async()=>{
  vi.useFakeTimers();
  const fetch=vi.fn().mockImplementationOnce(async()=>new Response('<p>Published HTML</p>',{headers:{'content-type':'text/html'}})).mockRejectedValue(new DOMException('offline','TimeoutError'));
  vi.stubGlobal('fetch',fetch);
  expect(await Promise.all([readHtml('https://metadata.example/saved',1),readHtml('https://metadata.example/saved',1)])).toEqual(['<p>Published HTML</p>','<p>Published HTML</p>']);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1001);
  expect(await readHtml('https://metadata.example/saved',1)).toContain('Published HTML');
  expect(await readHtml('https://metadata.example/saved',1)).toContain('Published HTML');
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('blocks off-source requests and redirects before contacting any other origin', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, {status:302, headers:{location:'https://127.0.0.1/private'}}));
  vi.stubGlobal('fetch',fetch);
  await expect(readHtml('https://not-configured.example/')).rejects.toThrow('Invalid source URL');
  expect(fetch).not.toHaveBeenCalled();
  await expect(readHtml('https://metadata.example/redirect')).rejects.toThrow('temporarily unavailable');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('cancels oversized responses before buffering the complete body', async () => {
  const cancel=vi.fn();
  let sent=0;
  const body=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(1_000_000));sent++;},cancel});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(body,{headers:{'content-type':'text/html'}})));
  await expect(readHtml('https://metadata.example/oversized')).rejects.toThrow('temporarily unavailable');
  expect(cancel).toHaveBeenCalledOnce();
  expect(sent).toBeLessThanOrEqual(7);
});

it('caps concurrent uncached reads while still sharing an existing lookup', async () => {
  const finishes: (()=>void)[]=[];
  const fetch=vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>finishes.push(()=>resolve(new Response('<p>ok</p>',{headers:{'content-type':'text/html'}})))));
  vi.stubGlobal('fetch',fetch);
  const reads=Array.from({length:24},(_,i)=>readHtml(`https://metadata.example/${i}`));
  await expect(readHtml('https://metadata.example/overflow')).rejects.toThrow('temporarily unavailable');
  const shared=readHtml('https://metadata.example/0');
  expect(fetch).toHaveBeenCalledTimes(24);
  finishes.forEach(finish=>finish());
  expect(await shared).toBe('<p>ok</p>');
  await Promise.all(reads);
});
