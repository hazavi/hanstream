// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { validateApiRequest } from '../lib/request-validation';
import { contentSecurityPolicy, securityHeaders } from '../lib/security-policy.mjs';
import { staticPagePolicy } from '../scripts/secure-pages.mjs';
import { middleware } from '../middleware';
import { createHash } from 'node:crypto';
import { fetchDrama, fetchEpisode, fetchSearch } from '../lib/api';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const lookup = (path: string) => validateApiRequest(new URL(path, 'https://app.example'));

it('accepts normal Unicode drama titles and multi-digit season/episode routes', () => {
  for (const path of ['/api/search?q=너+말고+다른+연애&page=2', '/api/artwork?title=Drama&year=2026', '/api/episode/drama-fixture--2026/s2e12', '/api/episode/drama-fixture/10.5', '/api/drama/' + encodeURIComponent('drama-다른-연애--2026')]) expect(lookup(path)).toBeUndefined();
});

it('enforces lookup limits on server-rendered calls as well as API requests', async () => {
  const fetch=vi.fn(); vi.stubGlobal('fetch',fetch);
  await expect(fetchSearch('a'.repeat(161))).rejects.toThrow('160 characters');
  await expect(fetchSearch('Drama', Infinity)).rejects.toThrow('valid page');
  await expect(fetchDrama('../private')).rejects.toThrow('Invalid drama');
  await expect(fetchEpisode('drama-fixture','9'.repeat(1000))).rejects.toThrow('Invalid episode');
  expect(fetch).not.toHaveBeenCalled();
});
it.each([
  '/api/search?q=', '/api/search?q=ok&q=other', '/api/search?q=ok%00',
  '/api/search?q=ok&page=Infinity', '/api/search?q=ok&page=-1', '/api/search?q=ok&page=1.2', '/api/search?q=ok&page=2001',
  '/api/artwork?title=Drama&year=NaN', '/api/artwork?title=Drama&year=2101',
  '/api/artwork?title=Drama&secondary=https://other.example',
  '/api/drama/%2e%2e%2fprivate', '/api/episode/drama-fixture/not-an-episode',
  '/api/search?q=' + 'a'.repeat(161),
])('rejects malformed input before it can start source reads: %s', path => {
  expect(lookup(path)).toBeTruthy();
});

it('rejects writes and unapproved origins while preserving allowed CORS and preflight', () => {
  vi.stubEnv('FRONTEND_ORIGINS', 'https://site.example');
  const request = (method: string, origin: string, path = '/api/home') => new NextRequest('https://backend.example' + path, { method, headers: { origin } });
  expect(middleware(request('POST', 'https://site.example')).status).toBe(405);
  expect(middleware(request('GET', 'https://site.example.evil.test')).status).toBe(403);
  expect(middleware(request('GET', 'https://site.example', '/api/search?q=' )).status).toBe(400);
  const cors = middleware(request('GET', 'https://site.example'));
  expect(cors.headers.get('access-control-allow-origin')).toBe('https://site.example');
  expect(cors.headers.get('vary')).toContain('Origin');
  expect(middleware(request('OPTIONS', 'https://site.example', '/api/search')).status).toBe(204);
});

it('restricts production policy without preventing the configured public API or video frames', () => {
  const policy = contentSecurityPolicy({ apiOrigin: 'https://backend.example' });
  expect(policy).toContain("connect-src 'self' https://backend.example");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("script-src-attr 'none'");
  expect(policy).not.toContain('unsafe-eval');
  expect(contentSecurityPolicy({ development: true })).toContain('unsafe-eval');
  const headers = Object.fromEntries(securityHeaders().map(({key,value})=>[key,value]));
  expect(headers['X-Content-Type-Options']).toBe('nosniff');
  expect(headers['X-Frame-Options']).toBe('DENY');
  expect(headers['Permissions-Policy']).toContain('camera=()');
});

it('permits only the exact inline boot scripts in static Pages HTML', () => {
  const script = 'self.__next_f.push([1,"fixture"]);';
  const policy = staticPagePolicy(`<html><head><script>${script}</script><script src="/chunk.js"></script></head></html>`, 'https://backend.example');
  const hash = createHash('sha256').update(script).digest('base64');
  expect(policy).toContain(`'sha256-${hash}'`);
  expect(policy).not.toMatch(/script-src[^;]*unsafe-(?:inline|eval)/);
  expect(policy).not.toContain('frame-ancestors'); // Not supported in a meta policy.
});
