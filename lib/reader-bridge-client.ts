import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { readerNamespace } from "./deployment";
import { readerTiming, type ReaderJob } from "./reader-protocol";
import { ReaderPending, ReaderUnavailable } from "./reader-errors";

const saved = new Map<string, { value: unknown; at: number; bytes: number }>();
const loading = new Map<string, Promise<unknown>>();
let bytes = 0;
export function bridgeConfigured() {
  return Boolean(
    process.env.READER_GATEWAY_ORIGIN && process.env.READER_GATEWAY_SECRET,
  );
}
function settings() {
  const value = process.env.READER_GATEWAY_ORIGIN || "";
  const token = process.env.READER_GATEWAY_SECRET || "";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ReaderUnavailable();
  }
  if (
    url.protocol !== "https:" ||
    url.origin !== value ||
    url.username ||
    url.password ||
    url.port ||
    url.hostname.endsWith(".") ||
    !url.hostname.includes(".") ||
    /^[\d.]+$/.test(url.hostname) ||
    url.hostname.includes(":") ||
    /\.(?:local|localhost|internal)$/.test(url.hostname) ||
    token.length < 32 ||
    token.length > 128
  )
    throw new ReaderUnavailable();
  return {
    url: url.origin + "/api/reader-bridge",
    headers: {
      Authorization: "Bearer " + token,
      "X-Reader-Namespace": readerNamespace(),
      "Content-Type": "application/json",
    },
  };
}
async function json(response: Response) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    await response.body?.cancel();
    throw new ReaderPending();
  }
  const stream = response.body?.getReader();
  if (!stream) throw new ReaderUnavailable();
  const parts: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await stream.read();
    if (part.done) break;
    length += part.value.byteLength;
    if (length > 2_100_000) {
      await stream.cancel();
      throw new ReaderUnavailable();
    }
    parts.push(part.value);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new ReaderUnavailable();
  }
}
export async function bridgeHealth() {
  const config = settings();
  const response = await fetch(config.url, {
    headers: config.headers,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new ReaderUnavailable();
  const data = await json(response);
  if (data.namespace !== readerNamespace() || data.role !== "reader")
    throw new ReaderUnavailable();
  return data as {
    readerReady: boolean;
    cacheReady: boolean;
    namespace: string;
    role: "reader";
  };
}
export async function readBridge<T>(job: ReaderJob): Promise<T> {
  const id = createHash("sha256").update(JSON.stringify(job)).digest("hex");
  const key = readerNamespace() + ":" + id;
  const previous = saved.get(key);
  const timing = readerTiming(job, previous?.value);
  if (previous && Date.now() - previous.at < timing.fresh)
    return previous.value as T;
  const refresh = () => {
    const existing = loading.get(key);
    if (existing) return existing as Promise<T>;
    const task = (async () => {
      const config = settings();
      let response: Response;
      try {
        response = await fetch(config.url, {
          method: "POST",
          headers: config.headers,
          body: JSON.stringify(job),
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(12_000),
        });
      } catch {
        throw new ReaderPending();
      }
      if (response.status === 202) {
        await response.body?.cancel();
        throw new ReaderPending();
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new ReaderUnavailable();
      }
      const record = await json(response);
      if (
        record.version !== 1 ||
        record.namespace !== readerNamespace() ||
        record.id !== id ||
        !Object.hasOwn(record, "value")
      )
        throw new ReaderUnavailable();
      const size = Buffer.byteLength(JSON.stringify(record.value));
      const old = saved.get(key);
      if (old) {
        bytes -= old.bytes;
        saved.delete(key);
      }
      saved.set(key, { value: record.value, at: Date.now(), bytes: size });
      bytes += size;
      while (saved.size > 64 || bytes > 16_000_000) {
        const first = saved.keys().next().value!;
        bytes -= saved.get(first)!.bytes;
        saved.delete(first);
      }
      return record.value as T;
    })().finally(() => loading.delete(key));
    loading.set(key, task);
    return task;
  };
  if (
    previous &&
    job.kind !== "episode" &&
    Date.now() - previous.at < timing.retain * 1000
  ) {
    const task = () => refresh().catch(() => {});
    try {
      after(task);
    } catch {
      void task();
    }
    return previous.value as T;
  }
  return refresh();
}
