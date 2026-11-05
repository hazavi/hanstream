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
class ImageBusy extends Error {}
let active = 0;
const waiting: (()=>void)[]=[];
async function acquire() {
  if(active<4){active++;return;}
  await new Promise<void>((resolve,reject)=>{
    const ready=()=>{clearTimeout(timer);resolve();};
    const timer=setTimeout(()=>{const index=waiting.indexOf(ready);if(index>=0)waiting.splice(index,1);reject(new ImageBusy());},2000);
    waiting.push(ready);
  });
}
function release(){const next=waiting.shift();if(next)next();else active--;}
export const imageBusyResponse=()=>new Response(null,{status:503,headers:{'Retry-After':'2','Cache-Control':'no-store'}});

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
  if (pending.size >= 32) throw new ImageBusy();
  count('image.miss');
  const task = (async()=>{await acquire();try{return await download(url,width);}finally{release();}})().then(image => {
    if (!image) return undefined;
    const old = images.get(key);
    if (old) { bytes -= old.body.length; images.delete(key); }
    while (bytes + image.body.length > MAX_CACHE && images.size) {
      const first = images.keys().next().value!; bytes -= images.get(first)!.body.length; images.delete(first);
    }
    bytes += image.body.length; images.set(key, { ...image, expires: Date.now() + 3_600_000 });
    return image;
  }).catch(error => { if(error instanceof ImageBusy)throw error;count('image.failure'); return undefined; }).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

export async function imageResponse(url: string, request: Request, fallbackTtl: number) {
  const width = Number(new URL(request.url).searchParams.get('width')) || 320;
  let image:Awaited<ReturnType<typeof cachedImage>>;
  try{image=await cachedImage(url,[80,160,320,640].includes(width)?width:320);}catch(error){if(error instanceof ImageBusy)return imageBusyResponse();throw error;}
  const headers = { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'ETag': image?.etag || '' };
  if (image) return request.headers.get('if-none-match') === image.etag ? new Response(null, { status: 304, headers }) : new Response(new Uint8Array(image.body), { headers });
  return missingImageResponse(fallbackTtl);
}

/** A genuine miss is a short-lived neutral image, never a broken redirect. */
export function missingImageResponse(ttl = 60, portrait = false) {
  const drawing = portrait
    ? '<circle cx="160" cy="175" r="38"/><path d="M98 290v-24a62 62 0 0 1 124 0v24"/>'
    : '<rect x="116" y="162" width="88" height="110" rx="8"/><path d="m144 202 34 19-34 19z"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480"><rect width="320" height="480" fill="#151518"/><g fill="none" stroke="#96969c" stroke-width="3">${drawing}</g>${portrait ? '' : '<text x="160" y="310" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#bdbdc2">Artwork unavailable</text>'}</svg>`;
  return new Response(svg, {headers:{'Content-Type':'image/svg+xml','X-Content-Type-Options':'nosniff','Cache-Control':`public, max-age=${Math.min(ttl,60)}`,'Content-Security-Policy':"default-src 'none'; sandbox",'X-Artwork-Available':'0'}});
}
