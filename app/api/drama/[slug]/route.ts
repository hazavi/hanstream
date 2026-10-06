import { NextResponse } from "next/server";
import { fetchDrama } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    return NextResponse.json(await fetchDrama((await params).slug));
  } catch (error) {
    console.error("Simkl drama lookup failed:", error);
    return NextResponse.json({ error: "Drama unavailable" }, { status: 502 });
  }
}
