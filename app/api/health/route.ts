import { NextResponse } from "next/server";
import { getSourceConfig } from "@/lib/server-config.mjs";

export const dynamic = "force-dynamic";
export function GET() {
  try {
    getSourceConfig();
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "not_ready", error: "Backend configuration is incomplete." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
