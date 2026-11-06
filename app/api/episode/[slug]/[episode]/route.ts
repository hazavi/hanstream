import {readerErrorResponse} from '@/lib/reader-response';
import { NextResponse } from "next/server";
import { fetchEpisode } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; episode: string }> }) {
  try {
    const { slug, episode } = await params;
    const playback = await fetchEpisode(slug, episode);
    return NextResponse.json(playback, {headers:{'Cache-Control':'no-store'}});
  } catch(error) { return readerErrorResponse(error,"Episode unavailable"); }
}
