import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { readerNamespace } from "./deployment";
import {
  readerTiming,
  type ReaderJob,
  type ReaderImage,
} from "./reader-protocol";
import { detailNeedsRefresh } from "./detail-cache";
import { hasHomeContent, type HomeData } from "./home-data";
import type { DramaResponse } from "./api-types";

// Do not cache transport errors, missing images, or expiring playback URLs.
class PartialReaderValue extends Error {
  #value: unknown;
  constructor(value: unknown) {
    super("Reader result is still incomplete.");
    this.#value = value;
  }
  get value() {
    return this.#value;
  }
}
export async function durableReaderValue<T>(
  job: ReaderJob,
  load: () => Promise<T>,
): Promise<T> {
  if (job.kind === "episode" || job.kind === "search") return load();
  const scope = createHash("sha256")
    .update(process.env.READER_GATEWAY_ORIGIN || "")
    .digest("hex");
  const id = createHash("sha256").update(JSON.stringify(job)).digest("hex");
  const read = unstable_cache(
    async () => {
      const value = await load();
      if (
        (job.kind === "home" && !hasHomeContent(value as HomeData)) ||
        (job.kind === "drama" &&
          detailNeedsRefresh((value || {}) as DramaResponse)) ||
        ((job.kind === "artwork" || job.kind === "portrait") &&
          ((value as ReaderImage)?.headers?.["x-artwork-available"] === "0" ||
            (value as ReaderImage)?.status !== 200 ||
            !/^image\/(?:webp|svg\+xml|jpeg|png|avif)(?:;|$)/.test(
              (value as ReaderImage)?.headers?.["content-type"] || "",
            )))
      )
        throw new PartialReaderValue(value);
      return { value, at: Date.now() };
    },
    ["reader-public-v1", readerNamespace(), scope, id, job.kind === 'drama' ? 'english-v2' : 'base'],
    {
      revalidate: Math.max(1, Math.floor(readerTiming(job).fresh / 1000)),
      tags: ["reader-public-" + job.kind],
    },
  );
  try {
    const record = await read();
    if (Date.now() - record.at > readerTiming(job, record.value).retain * 1000)
      return load();
    return record.value;
  } catch (error) {
    if (error instanceof PartialReaderValue) return error.value as T;
    throw error;
  }
}
