import { NextResponse } from "next/server";
import { findCatalogArtwork } from "@/lib/catalog-details";
import { imageResponse, missingImageResponse } from '@/lib/image-cache';
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const title = query.get('title')?.trim();
  const year = Number(query.get('year')) || undefined;
  if (!title || title.length > 160 || year && (year < 1900 || year > 2100)) return new NextResponse(null, { status: 400 });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const resolve = async () => {
    for (const secondary of query.get('secondary') === '1' ? [true] : [false,true]) {
      try {
        const image = await findCatalogArtwork(JSON.stringify({title,year,secondary}));
        if (!image?.startsWith('https://')) continue;
        const response = await imageResponse(image,request,60);
        if (response.headers.get('X-Artwork-Available') !== '0') return response;
      } catch { /* Try the next approved, independently matched cover. */ }
    }
    return missingImageResponse();
  };
  return Promise.race([resolve(),new Promise<Response>(resolve => {timer=setTimeout(()=>resolve(missingImageResponse()),11_000);})]).finally(()=>clearTimeout(timer));
}
