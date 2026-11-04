// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
const network = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('undici', () => ({ Agent: class {}, request: network.request }));
import { cachedImage, imageResponse, isPublicAddress } from '../lib/image-cache';
import sharp from 'sharp';
afterEach(() => { vi.unstubAllEnvs(); network.request.mockReset(); });
it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '224.0.0.1'])('blocks non-public image destinations: %s', address => expect(isPublicAddress(address)).toBe(false));
it('does not fetch unapproved origins or a redirect to an internal address', async () => {
  vi.stubEnv('IMAGE_ORIGINS', 'https://images.example');
  expect(await cachedImage('https://other.example/photo.jpg')).toBeUndefined();
  expect(network.request).not.toHaveBeenCalled();
  const destroy = vi.fn();
  network.request.mockResolvedValue({ statusCode: 302, headers: { location: 'https://127.0.0.1/private' }, body: { destroy } });
  expect(await cachedImage('https://images.example/redirect')).toBeUndefined();
  expect(network.request).toHaveBeenCalledOnce(); expect(destroy).toHaveBeenCalled();
});
it('resizes trusted artwork, reuses image bytes, and supports conditional requests', async () => {
  vi.stubEnv('IMAGE_ORIGINS', 'https://images.example');
  const input = await sharp({ create: { width: 800, height: 1200, channels: 3, background: 'black' } }).png().toBuffer();
  network.request.mockResolvedValue({ statusCode: 200, headers: { 'content-type': 'image/png' }, body: (async function* () { yield input; })() });
  const url = 'https://images.example/poster.png';
  const image = await cachedImage(url, 160);
  expect((await sharp(image!.body).metadata()).width).toBe(160);
  const response = await imageResponse(url, new Request('https://app.example/api/artwork?width=160', { headers: { 'if-none-match': image!.etag } }), 3600);
  expect(response.status).toBe(304); expect(network.request).toHaveBeenCalledOnce();
});
