import { NextResponse } from "next/server";
import { findCatalogArtwork } from "@/lib/catalog-details";
import { imageResponse } from '@/lib/image-cache';
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const title = query.get('title')?.trim();
  const year = Number(query.get('year')) || undefined;
  if (!title || title.length > 160 || year && (year < 1900 || year > 2100)) return new NextResponse(null, { status: 400 });
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const image = await Promise.race([findCatalogArtwork(JSON.stringify({ title, year, secondary: query.get('secondary') === '1' })), new Promise<undefined>(resolve => {timer=setTimeout(()=>resolve(undefined),5500);})]).finally(()=>clearTimeout(timer));
    if (image && image.startsWith('https://')) return imageResponse(image, request, 3600);
  } catch { /* A poster miss should not affect the rest of the page. */ }
  return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
