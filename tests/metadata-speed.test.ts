// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { enrichArtwork } from '../lib/metadata';
import { findCatalogArtwork } from '../lib/catalog-details';
vi.mock('next/cache',()=>({unstable_cache:(fn: unknown)=>fn}));
vi.mock('../lib/catalog-details',()=>({findCatalogArtwork:vi.fn()}));
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
it('returns listings within the image budget while preserving recovered artwork for subsequent requests',async()=>{
  vi.useFakeTimers();
  let release: (image:string)=>void = ()=>{};
  const pending = new Promise<string>(resolve=>{release=resolve;});
  vi.mocked(findCatalogArtwork).mockReturnValue(pending);
  const items = ['One','Two'].map(title=>({title,image:'/file.svg',url:'/drama/'+title}));
  let complete=false;
  const result=enrichArtwork(items).then(value=>{complete=true;return value;});
  await vi.advanceTimersByTimeAsync(999);
  expect(complete).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  const first=await result;
  expect(first.map(item=>item.image)).toEqual(['/file.svg','/file.svg']);
  release('https://pictures.example/poster.jpg');
  await vi.advanceTimersByTimeAsync(0);
  expect((await enrichArtwork(items)).every(item=>item.image==='https://pictures.example/poster.jpg')).toBe(true);
  expect(first[0].image).toBe('/file.svg');
});
