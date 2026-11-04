// @vitest-environment node
import { expect, it } from 'vitest';
import { exportProfile, importProfile, validateProfile } from '../lib/profile-transfer';
import { DEFAULT_PROFILE } from '../lib/types';
const profile = { ...DEFAULT_PROFILE, watchlist: [{slug:'drama-fixture--2026',title:'Fixture',status:'watching' as const,dateAdded:'2026-11-04T00:00:00Z',image:'/file.svg'}], watchedEpisodes: {'drama-fixture--2026':['s1e10','s1e11']} };
it('round-trips library entries and multi-digit watched history without native filesystem access', () => {
  const restored = importProfile(exportProfile(profile));
  expect(restored.watchlist[0].slug).toBe('drama-fixture--2026');
  expect(restored.watchedEpisodes?.['drama-fixture--2026']).toEqual(['s1e10','s1e11']);
});
it('rejects oversized, unversioned, executable-URL, and malformed-progress imports', () => {
  expect(() => importProfile('a'.repeat(1_000_001))).toThrow('1 MB');
  expect(() => importProfile('{}')).toThrow('Unsupported');
  expect(() => validateProfile({...profile,watchlist:[{...profile.watchlist[0],image:'javascript:alert(1)'}]})).toThrow();
  expect(() => validateProfile({...profile,continueWatching:[{slug:'fixture',title:'Fixture',currentEpisode:Infinity}]})).toThrow();
  expect(() => validateProfile({...profile,watchedEpisodes:{constructor:['s1e1']}})).toThrow();
});
it('discards unknown properties instead of merging imported object keys', () => {
  const restored = validateProfile({...profile,privateToken:'discard',watchlist:[{...profile.watchlist[0],privateToken:'discard'}]});
  expect(JSON.stringify(restored)).not.toContain('privateToken');
});
