import { NextRequest, NextResponse } from "next/server";
import { allowedFrontend } from "./lib/cors";

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = !origin || origin === request.nextUrl.origin || allowedFrontend(origin);
  const response = !allowed
    ? NextResponse.json({ error: "Origin not allowed" }, { status: 403 })
    : request.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  response.headers.append("Vary", "Origin");
  if (origin && allowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return response;
}
export const config = { matcher: "/api/:path*" };
