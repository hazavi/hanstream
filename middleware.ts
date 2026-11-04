import { NextRequest, NextResponse } from "next/server";
import { allowedFrontend } from "./lib/cors";
import { validateApiRequest } from './lib/request-validation';

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = !origin || origin === request.nextUrl.origin || allowedFrontend(origin);
  const invalid = validateApiRequest(request.nextUrl);
  const response = !allowed
    ? NextResponse.json({ error: "Origin not allowed" }, { status: 403 })
    : !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      ? NextResponse.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET, HEAD, OPTIONS' } })
      : request.method === 'OPTIONS' ? new NextResponse(null, { status: 204 })
      : invalid ? NextResponse.json({ error: invalid }, { status: 400 }) : NextResponse.next();
  response.headers.append("Vary", "Origin");
  if (origin && allowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  if (response.status >= 400) response.headers.set('Cache-Control', 'no-store');
  return response;
}
export const config = { matcher: "/api/:path*" };
