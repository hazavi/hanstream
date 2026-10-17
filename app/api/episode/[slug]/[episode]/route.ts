import { NextResponse } from "next/server";
import { fetchDrama, fetchEpisode } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; episode: string }> }) {
  try {
    const { slug, episode } = await params;
    const [playback, drama] = await Promise.all([fetchEpisode(slug, episode), fetchDrama(slug)]);
    return NextResponse.json({ ...playback, drama: drama.result });
  } catch { return NextResponse.json({ error: "Episode unavailable" }, { status: 502 }); }
}
