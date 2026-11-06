import { createClient } from "redis";
import { randomUUID } from "node:crypto";
import { cacheConnectionUrl } from "../lib/persistent-cache";
import { readerKeys } from "../lib/reader-queue";
import { readerNamespace } from "../lib/deployment";
import {
  parseReaderJob,
  readerTiming,
  type ReaderJob,
} from "../lib/reader-protocol";
import { executeReaderJob } from "../lib/source-handler";

export type WorkerOptions = {
  execute?: (job: ReaderJob) => Promise<unknown>;
  concurrency?: number;
  blockMs?: number;
};
const finishScript = `if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end if ARGV[2]~='' then redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[3]) end redis.call('XACK',KEYS[3],'readers',ARGV[4]) redis.call('XDEL',KEYS[3],ARGV[4]) redis.call('DEL',KEYS[1],KEYS[4]) return 1`;
export async function startReaderWorker(options: WorkerOptions = {}) {
  if (process.env.VERCEL === "1" || process.env.HANSTREAM_ROLE === "web")
    throw new Error("The source worker must run outside Vercel.");
  const url = cacheConnectionUrl();
  const root = readerNamespace();
  const execute = options.execute || executeReaderJob;
  const total = Math.min(4, Math.max(2, options.concurrency || 3));
  let stopping = false;
  const clients: Array<{ isOpen: boolean; isReady: boolean; destroy(): void }> =
    [];
  const tasks = Array.from({ length: total }, (_, index) =>
    (async () => {
      const queue = root + (index === 0 ? ":urgent" : ":normal"),
        consumer = randomUUID();
      const client = createClient({
        url,
        disableOfflineQueue: true,
        commandsQueueMaxLength: 10,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (attempt) =>
            Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)),
        },
      });
      clients.push(client);
      client.on("error", () => {});
      await client.connect();
      try {
        await client.xGroupCreate(queue, "readers", "0", { MKSTREAM: true });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("BUSYGROUP"))
          throw error;
      }
      async function processMessage(message: {
        id: string;
        message: Record<string, string>;
      }) {
        let envelope: {
          version: number;
          id: string;
          createdAt: number;
          job: ReaderJob;
        };
        try {
          const raw = message.message.payload;
          if (typeof raw !== "string" || Buffer.byteLength(raw) > 2000)
            throw Error();
          envelope = JSON.parse(raw);
          envelope.job = parseReaderJob(envelope.job);
          if (
            envelope.version !== 1 ||
            !Number.isFinite(envelope.createdAt) ||
            Date.now() - envelope.createdAt > 300_000 ||
            envelope.createdAt > Date.now() + 5000 ||
            readerKeys(envelope.job).id !== envelope.id
          )
            throw Error();
        } catch {
          await client.xAck(queue, "readers", message.id);
          await client.xDel(queue, message.id);
          return;
        }
        const keys = readerKeys(envelope.job);
        const lease = randomUUID();
        if (
          (await client.set(keys.lease, lease, { NX: true, EX: 60 })) !== "OK"
        )
          return;
        let record = "",
          retain = 3;
        try {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const value = await Promise.race([
            execute(envelope.job),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error("Reader deadline exceeded.")),
                45_000,
              );
            }),
          ]).finally(() => clearTimeout(timer));
          retain = readerTiming(envelope.job).retain;
          if (
            envelope.job.kind === "episode" &&
            !(value as { result?: { video?: string } })?.result?.video
          )
            retain = 2;
          if (
            (envelope.job.kind === "artwork" ||
              envelope.job.kind === "portrait") &&
            (value as { headers?: Record<string, string> })?.headers?.[
              "x-artwork-available"
            ] === "0"
          )
            retain = 60;
          record = JSON.stringify({
            version: 1,
            id: keys.id,
            fetchedAt: Date.now(),
            value,
          });
          if (Buffer.byteLength(record) > 2_000_000)
            throw Error("Reader result exceeds its size limit.");
        } catch {
          // Keep a previous successful response when a source temporarily fails.
          const previous = await client.get(keys.result);
          if (!previous)
            record = JSON.stringify({
              version: 1,
              id: keys.id,
              fetchedAt: Date.now(),
              error: true,
            });
          else record = "";
          retain = 3;
        }
        await client.eval(finishScript, {
          keys: [keys.lease, keys.result, queue, keys.pending],
          arguments: [lease, record, String(retain), message.id],
        });
      }
      while (!stopping) {
        try {
          await client.set(root + ":heartbeat", String(Date.now()), {
            EX: 180,
          });
          const recovered = await client.xAutoClaim(
            queue,
            "readers",
            consumer,
            60_000,
            "0-0",
            { COUNT: 1 },
          );
          if (recovered.messages.length) {
            for (const message of recovered.messages)
              if (message) await processMessage(message);
            continue;
          }
          const pages = await client.xReadGroup(
            "readers",
            consumer,
            [{ key: queue, id: ">" }],
            { COUNT: 1, BLOCK: options.blockMs || 60_000 },
          );
          for (const page of pages || [])
            for (const message of page.messages) await processMessage(message);
        } catch (error) {
          if (
            !stopping &&
            error instanceof Error &&
            error.message.includes("NOGROUP")
          ) {
            // Eviction can remove a stream. Restore its group before consuming again.
            await client
              .xGroupCreate(queue, "readers", "0", { MKSTREAM: true })
              .catch(() => {});
          }
          if (!stopping)
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    })()
      .catch(() => {
        if (!stopping)
          console.error(
            "A reader consumer stopped. Check the private cache configuration.",
          );
      })
      .finally(() => {
        const client = clients[index];
        if (client?.isOpen) client.destroy();
      }),
  );
  return {
    ready: () =>
      clients.length === total && clients.every((client) => client.isReady),
    done: Promise.all(tasks),
    stop: async () => {
      stopping = true;
      for (const client of clients) if (client.isOpen) client.destroy();
      await Promise.all(tasks);
    },
  };
}
