import { NextResponse } from "next/server";
import { artworkLookups } from "@/lib/catalog-details";
import { imageResponse, missingImageResponse, imageBusyResponse } from '@/lib/image-cache';
export async function readSourceArtwork(request: Request) {
  const query = new URL(request.url).searchParams;
  const title = query.get('title')?.trim();
  const year = Number(query.get('year')) || undefined;
  if (!title || title.length > 160 || year && (year < 1900 || year > 2100)) return new NextResponse(null, { status: 400 });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const resolve = async () => {
    let busy=false;
    const lookups=artworkLookups(JSON.stringify({title,year,secondary:query.get('secondary')==='1',movie:query.get('movie')==='1'}));
    try{return await Promise.any(lookups.map(async load=>{
      const image=await load();
      if(!image?.startsWith('https://'))throw new Error('No matched artwork');
      const response=await imageResponse(image,request,5);
      if(response.status>=500)busy=true;
      if((response.ok||response.status===304)&&response.headers.get('X-Artwork-Available')!=='0')return response;
      throw new Error('Poster image unavailable');
    }));}catch{return busy?imageBusyResponse():missingImageResponse(5);}
  };
  return Promise.race([resolve(),new Promise<Response>(resolve => {timer=setTimeout(()=>resolve(imageBusyResponse()),11_000);})]).finally(()=>clearTimeout(timer));
}
