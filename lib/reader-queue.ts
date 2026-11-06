import "server-only";
import { createHash } from "node:crypto";
import { cacheCommand } from "./persistent-cache";
import { readerNamespace, webRuntime } from "./deployment";
import {
  parseReaderJob,
  readerTiming,
  type ReaderJob,
} from "./reader-protocol";
import { after } from "next/server";

export class ReaderPending extends Error {
  constructor() {
    super("The catalog reader is preparing this request.");
  }
}
export class ReaderUnavailable extends Error {
  constructor() {
    super("The catalog reader is unavailable. Please try again shortly.");
  }
}
export function readerKeys(job: ReaderJob) {
  const root = readerNamespace();
  const id = createHash("sha256").update(JSON.stringify(job)).digest("hex");
  return {
    id,
    queue: root + (job.kind === "episode" ? ":urgent" : ":normal"),
    pending: root + ":pending:" + id,
    result: root + ":result:" + id,
    lease: root + ":lease:" + id,
  };
}
const enqueueScript = `if redis.call('EXISTS',KEYS[1])==1 then return 0 end if redis.call('XLEN',KEYS[2])>=64 then return -1 end redis.call('SET',KEYS[1],'queued','EX',120) redis.call('XADD',KEYS[2],'*','payload',ARGV[1]) return 1`;
function wakeReader() {
  const value = process.env.READER_WAKE_ORIGIN;
  if (!value) return;
  const task = (async () => {
    const url = new URL(value);
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
      /\.(?:local|localhost|internal)$/.test(url.hostname)
    )
      return;
    await fetch(url.origin + "/health", {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
      credentials: "omit",
    });
  })().catch(() => {});
  try {
    after(() => task);
  } catch {
    void task;
  }
}
export async function enqueueReader(job: ReaderJob) {
  const keys = readerKeys(job);
  const payload = JSON.stringify({
    version: 1,
    id: keys.id,
    createdAt: Date.now(),
    job,
  });
  const queued = await cacheCommand((client) =>
    client.eval(enqueueScript, {
      keys: [keys.pending, keys.queue],
      arguments: [payload],
    }),
  );
  if (queued === undefined || Number(queued) < 0) throw new ReaderUnavailable();
  if (Number(queued) === 1) wakeReader();
}
export async function requestReader<T>(input: ReaderJob): Promise<T> {
  const job = parseReaderJob(input);
  if (!webRuntime())
    return (await import("@reader/handler")).executeReaderJob(
      job,
    ) as Promise<T>;
  if (!process.env.CACHE_URL) throw new ReaderUnavailable();
  const keys = readerKeys(job);
  const raw = await cacheCommand((client) => client.get(keys.result));
  if (raw && Buffer.byteLength(raw) <= 2_000_000) {
    try {
      const record = JSON.parse(raw);
      const age = Date.now() - record.fetchedAt;
      if (
        record.version === 1 &&
        record.id === keys.id &&
        Number.isFinite(age) &&
        age >= 0 &&
        age < readerTiming(job).retain * 1000
      ) {
        if (record.error) throw new ReaderUnavailable();
        if (age >= readerTiming(job).fresh)
          await enqueueReader(job).catch(() => {});
        return record.value as T;
      }
    } catch (error) {
      if (error instanceof ReaderUnavailable) throw error;
    }
  }
  await enqueueReader(job);
  throw new ReaderPending();
}
