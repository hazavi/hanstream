import {readerErrorResponse} from '@/lib/reader-response';
import { NextResponse } from "next/server";
import { getHomeData } from '@/lib/home';
import {hasHomeContent} from '@/lib/home-data';
import {publicCatalogHeaders} from '@/lib/public-cache';
export const dynamic = "force-dynamic";
export async function GET() {
  const started = performance.now();
  try {
    const data = await getHomeData();
    return NextResponse.json(data, { headers: { ...(hasHomeContent(data)?publicCatalogHeaders(data.partial?10:30):{'Cache-Control':'no-store'}), 'Server-Timing': `home;dur=${(performance.now() - started).toFixed(1)}` } });
  } catch(error) { return readerErrorResponse(error,"Drama listings unavailable"); }
}
