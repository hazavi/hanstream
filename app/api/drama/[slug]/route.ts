import {readerErrorResponse} from '@/lib/reader-response';
import { NextResponse } from "next/server";
import { fetchDrama } from "@/lib/api";
import { detailNeedsRefresh } from '@/lib/detail-cache';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const started = performance.now();
  try {
    const data = await fetchDrama((await params).slug);
    return NextResponse.json(data, { headers: { 'Cache-Control': detailNeedsRefresh(data) ? 'no-store' : 'public, max-age=60, stale-while-revalidate=300', 'Server-Timing': `detail;dur=${(performance.now() - started).toFixed(1)}` } });
  } catch (error) {
    return readerErrorResponse(error,"Drama unavailable");
  }
}
