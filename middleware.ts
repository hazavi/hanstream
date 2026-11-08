import { NextRequest, NextResponse } from "next/server";
import { allowedFrontend } from "./lib/cors";
import { validateApiRequest } from './lib/request-validation';
import { contentSecurityPolicy } from './lib/security-policy.mjs';
import { checkRateLimit } from './lib/rate-limit';

export async function middleware(request: NextRequest) {
  if(request.nextUrl.pathname==='/api/reader-bridge'){
    if(process.env.VERCEL==='1'||process.env.HANSTREAM_ROLE==='web')return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
    // This machine endpoint authenticates before reading its bounded request body.
    return NextResponse.next();
  }
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    const nonce = crypto.randomUUID().replaceAll('-', '');
    const policy = contentSecurityPolicy({ nonce, development: process.env.NODE_ENV === 'development' });
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('Content-Security-Policy', policy);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set('Content-Security-Policy', policy);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  const origin = request.headers.get("origin");
  // Desktop posters are normal cross-origin images and carry no Origin header.
  const publicImage=['/api/artwork','/api/portrait'].includes(request.nextUrl.pathname)&&request.headers.get('sec-fetch-dest')==='image';
  const allowed = origin ? origin === request.nextUrl.origin || allowedFrontend(origin) : request.headers.get('sec-fetch-site')!=='cross-site'||publicImage;
  const invalid = validateApiRequest(request.nextUrl);
  let response = !allowed
    ? NextResponse.json({ error: "Origin not allowed" }, { status: 403 })
    : !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      ? NextResponse.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET, HEAD, OPTIONS' } })
      : request.method === 'OPTIONS' ? new NextResponse(null, { status: 204 })
      : invalid ? NextResponse.json({ error: invalid }, { status: 400 }) : NextResponse.next();
  if (allowed && !invalid && ['GET', 'HEAD'].includes(request.method)) {
    const limit = await checkRateLimit(request.nextUrl.pathname, request.headers);
    if (!limit.allowed) response = NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
  }
  response.headers.append("Vary", "Origin");
  if (origin && allowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  if (response.status >= 400) response.headers.set('Cache-Control', 'no-store');
  return response;
}
export const config = { runtime: 'nodejs', matcher: ['/api/:path*', '/((?!api|_next|favicon.ico|avatars|file.svg).*)'] };
