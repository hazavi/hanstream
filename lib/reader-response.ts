import { NextResponse } from "next/server";
import {
  ReaderPending,
  ReaderUnavailable,
  requestReader,
} from "./reader-queue";
import type { ReaderJob, ReaderImage } from "./reader-protocol";
export function readerErrorResponse(
  error: unknown,
  fallback = "Content is temporarily unavailable.",
) {
  if (error instanceof ReaderPending)
    return NextResponse.json(
      { pending: true, message: error.message },
      {
        status: 202,
        headers: { "Cache-Control": "no-store", "Retry-After": "2" },
      },
    );
  return NextResponse.json(
    { error: error instanceof ReaderUnavailable ? error.message : fallback },
    {
      status: error instanceof ReaderUnavailable ? 503 : 502,
      headers: { "Cache-Control": "no-store", "Retry-After": "3" },
    },
  );
}
export async function readerImageResponse(job: ReaderJob, request: Request) {
  const deadline = Date.now() + 5000;
  let image: ReaderImage;
  while (true) {
    try {
      image = await requestReader<ReaderImage>(job);
      break;
    } catch (error) {
      if (!(error instanceof ReaderPending) || Date.now() >= deadline)
        return new Response(null, {
          status: 503,
          headers: { "Cache-Control": "no-store", "Retry-After": "2" },
        });
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (
    !image ||
    typeof image.body !== "string" ||
    image.body.length > 1_400_000 ||
    !/^image\/(?:webp|svg\+xml|jpeg|png|avif)(?:;|$)/.test(
      image.headers?.["content-type"] || "",
    )
  )
    return new Response(null, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  const headers = { ...image.headers, "X-Content-Type-Options": "nosniff" };
  if (
    image.headers.etag &&
    request.headers.get("if-none-match") === image.headers.etag
  )
    return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(Buffer.from(image.body, "base64")), {
    status: image.status,
    headers,
  });
}
