import { NextResponse } from "next/server";
import {
  ReaderPending,
  ReaderUnavailable,
  requestReader,
} from "./reader-queue";
import type { ReaderJob, ReaderImage } from "./reader-protocol";
import {
  missingImageResponse,
  pendingImageResponse,
} from "./image-placeholder";
import { webRuntime } from "./deployment";
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
  let image: ReaderImage;
  try {
    image = await requestReader<ReaderImage>(job);
  } catch {
    // The client retries queued images. Do not poll the worker for every <img>.
    return webRuntime()
      ? pendingImageResponse()
      : missingImageResponse(5, job.kind === "portrait");
  }
  if (
    !image ||
    typeof image.body !== "string" ||
    image.body.length > 1_400_000 ||
    !/^image\/(?:webp|svg\+xml|jpeg|png|avif)(?:;|$)/.test(
      image.headers?.["content-type"] || "",
    )
  )
    return missingImageResponse(5, job.kind === "portrait");
  const headers = {
    ...image.headers,
    "X-Content-Type-Options": "nosniff",
    "Vercel-CDN-Cache-Control":
      image.headers["x-artwork-available"] === "0"
        ? "no-store"
        : "public, s-maxage=3600, stale-while-revalidate=86400",
  };
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
