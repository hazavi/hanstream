// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { clearHtmlCache, readHtml } from '../lib/html';
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
