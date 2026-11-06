import { NextResponse } from 'next/server';
import { findPortrait } from '@/lib/portrait-reader';
import { imageResponse, missingImageResponse } from '@/lib/image-cache';
export async function readSourcePortrait(request: Request) {
  const name = new URL(request.url).searchParams.get('name')?.trim();
  const key = new URL(request.url).searchParams.get('key') || undefined;
  if (!name || name.length > 120 || !/[\p{L}]/u.test(name) || /[<>/\\]/.test(name)) return new NextResponse(null, {status:400});
  if(key && (key.length>200 || !/^(?:article|profile):[\p{L}\p{N}_().,'’ -]+$/u.test(key))) return new NextResponse(null,{status:400});
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const image = await Promise.race([findPortrait(name,key), new Promise<undefined>(resolve => {timer=setTimeout(()=>resolve(undefined),5500);})]).finally(()=>clearTimeout(timer));
    if (image) return imageResponse(image, request, 86400);
  } catch { /* Missing portraits never block the detail page. */ }
  return missingImageResponse(60, true);
}
