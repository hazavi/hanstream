import { NextResponse } from "next/server";
import { findCatalogArtwork } from "@/lib/catalog-details";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const title = query.get('title')?.trim();
  const year = Number(query.get('year')) || undefined;
  if (!title || title.length > 160 || year && (year < 1900 || year > 2100)) return new NextResponse(null, { status: 400 });
  try {
    const image = await findCatalogArtwork(JSON.stringify({ title, year, secondary: query.get('secondary') === '1' }));
    if (image && image.startsWith('https://')) return NextResponse.redirect(image, { status: 307, headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch { /* A poster miss should not affect the rest of the page. */ }
  return new NextResponse(null, { status: 404 });
}
