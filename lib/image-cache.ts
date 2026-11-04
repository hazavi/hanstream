import 'server-only';
import { createHash } from 'node:crypto';
import ipaddr from 'ipaddr.js';
import { request } from 'undici';
import sharp from 'sharp';
import { count } from './diagnostics';
import { publicDispatcher } from './outbound';
export { isPublicAddress } from './outbound';

const MAX_INPUT = 5_000_000;
const MAX_CACHE = 24_000_000;
const images = new Map<string, { body: Buffer; etag: string; expires: number }>();
const pending = new Map<string, Promise<{ body: Buffer; etag: string } | undefined>>();
let bytes = 0;

function permitted(value: string) {
  const origins = (process.env.IMAGE_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && origins.includes(url.origin) && !ipaddr.isValid(url.hostname.replace(/^\[|\]$/g, ''));
}

async function download(value: string, width: number) {
  let url = value;
  const signal = AbortSignal.timeout(4500);
  for (let hop = 0; hop < 4; hop++) {
    if (!permitted(url)) return undefined;
    const response = await request(url, { dispatcher: publicDispatcher, signal, headersTimeout: 2500, bodyTimeout: 2500, headers: { accept: 'image/avif,image/webp,image/jpeg,image/png' } });
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      response.body.destroy();
      if (!response.headers.location) return undefined;
      url = new URL(String(response.headers.location), url).href;
      continue;
    }
    if (response.statusCode !== 200 || !/^image\/(?:jpeg|png|webp|avif)(?:;|$)/i.test(String(response.headers['content-type'])) || Number(response.headers['content-length']) > MAX_INPUT) {
      response.body.destroy(); return undefined;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > MAX_INPUT) { response.body.destroy(); return undefined; }
      chunks.push(Buffer.from(chunk));
    }
    const body = await sharp(Buffer.concat(chunks), { limitInputPixels: 25_000_000, animated: false }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    if (body.length > MAX_INPUT) return undefined;
    return { body, etag: `"${createHash('sha256').update(body).digest('base64url')}"` };
  }
}

/** Only server-discovered URLs enter this cache. No public arbitrary-URL proxy. */
export async function cachedImage(url: string, width = 320) {
  if (!permitted(url)) return undefined;
  const key = `${width}:${url}`;
  const saved = images.get(key);
  if (saved && saved.expires > Date.now()) {
    images.delete(key); images.set(key, saved); count('image.hit'); return saved;
  }
  if (pending.has(key)) return pending.get(key);
  if (pending.size >= 4) return undefined;
  count('image.miss');
  const task = download(url, width).then(image => {
    if (!image) return undefined;
    const old = images.get(key);
    if (old) { bytes -= old.body.length; images.delete(key); }
    while (bytes + image.body.length > MAX_CACHE && images.size) {
      const first = images.keys().next().value!; bytes -= images.get(first)!.body.length; images.delete(first);
    }
    bytes += image.body.length; images.set(key, { ...image, expires: Date.now() + 3_600_000 });
    return image;
  }).catch(() => { count('image.failure'); return undefined; }).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

export async function imageResponse(url: string, request: Request, fallbackTtl: number) {
  const width = Number(new URL(request.url).searchParams.get('width')) || 320;
  const image = await cachedImage(url, [80, 160, 320, 640].includes(width) ? width : 320);
  const headers = { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'ETag': image?.etag || '' };
  if (image) return request.headers.get('if-none-match') === image.etag ? new Response(null, { status: 304, headers }) : new Response(new Uint8Array(image.body), { headers });
  return new Response(null, { status: 307, headers: { Location: url, 'Cache-Control': `public, max-age=${fallbackTtl}` } });
}
