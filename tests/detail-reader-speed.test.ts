// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { findDramaDetails } from '../lib/details';
import { findCatalogDetails } from '../lib/catalog-details';
import { findReferenceDetail } from '../lib/reference-reader';
vi.mock('../lib/catalog-details',()=>({findCatalogDetails:vi.fn()}));
vi.mock('../lib/reference-reader',()=>({findReferenceDetail:vi.fn()}));
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.clearAllMocks();});

it('returns a fast matching fallback and picks up the richer guide after it finishes', async () => {
  vi.useFakeTimers();vi.stubEnv('CATALOG_SOURCE_URL','https://catalog.example');
  const record={title:'Fixture',url:'https://catalog.example/shows/1/fixture',image:'https://pictures.example/poster.jpg',country:'Korea',meta:{Released:2026},cast:[{name:'Actor'}]};
  let finish!: (value:typeof record)=>void;
  vi.mocked(findCatalogDetails).mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  vi.mocked(findReferenceDetail).mockResolvedValue({...record,title:'Fixture fallback'});
  const first=findDramaDetails('Fixture',2026);
  expect(findReferenceDetail).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1200);
  expect(await first).toMatchObject({title:'Fixture fallback',refreshPending:true});
  finish(record);await vi.advanceTimersByTimeAsync(0);
  expect((await findDramaDetails('Fixture',2026))?.title).toBe('Fixture');
});
