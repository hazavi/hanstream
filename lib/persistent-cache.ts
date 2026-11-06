import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "redis";
import { count } from "./diagnostics";

type Store = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
  isOpen: boolean;
  isReady?: boolean;
  destroy(): void;
};
let connection: Promise<Store | undefined> | undefined;
let cooldown = 0;
const MAX_BYTES = 2_000_000;
let currentClient: Store | undefined;
const budgets = new WeakMap<Store, { active: number; slow: number }>();

export function cacheConnectionUrl(env = process.env) {
  let url: URL;
  try {
    url = new URL(env.CACHE_URL || "");
  } catch {
    throw new Error("Set a valid private cache connection URL.");
  }
  const privateRender =
    env.RENDER === "true" &&
    url.hostname === env.CACHE_PRIVATE_HOST &&
    /^red-[a-z0-9]+$/.test(url.hostname) &&
    url.port === "6379";
  const local =
    env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    url.protocol !== "rediss:" &&
    !(url.protocol === "redis:" && (local || privateRender))
  )
    throw new Error(
      "Cache requires TLS or the explicitly configured Render private host",
    );
  return url.href;
}

async function store() {
  if (!process.env.CACHE_URL || Date.now() < cooldown) return undefined;
  if (!connection) {
    const attempt: Promise<Store | undefined> = (async () => {
      const url = new URL(cacheConnectionUrl());
      const client = createClient({
        url: url.href,
        disableOfflineQueue: true,
        commandsQueueMaxLength: 32,
        socket: { connectTimeout: 3000, reconnectStrategy: false },
      });
      currentClient = client;
      budgets.set(client, { active: 0, slow: 0 });
      client.on("error", () => {
        count("cache.failure");
        if (connection === attempt) {
          cooldown = Date.now() + 1000;
          connection = undefined;
          currentClient = undefined;
        }
        if (client.isOpen) client.destroy();
      });
      await client.connect();
      return client;
    })().catch(() => {
      count("cache.failure");
      if (connection === attempt) {
        cooldown = Date.now() + 1000;
        connection = undefined;
        currentClient = undefined;
      }
      return undefined;
    });
    connection = attempt;
  }
  const client = await connection;
  return client?.isReady === false ? undefined : client;
}

async function bounded<T>(run: () => Promise<T>, client: Store): Promise<T> {
  const budget = budgets.get(client) || { active: 0, slow: 0 };
  budgets.set(client, budget);
  if (budget.active >= 16) throw new Error("Cache is busy");
  budget.active++;
  const task = Promise.resolve()
    .then(run)
    .then((value) => {
      budget.slow = 0;
      return value;
    })
    .finally(() => {
      budget.active--;
    });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          if (++budget.slow >= 3 && currentClient === client) {
            connection = undefined;
            currentClient = undefined;
            cooldown = Date.now() + 1000;
            if (client.isOpen) client.destroy();
          }
          reject(new Error("Cache timeout"));
        }, 2000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function cacheCommand<T>(
  run: (client: Store) => Promise<T>,
): Promise<T | undefined> {
  const client = await store();
  if (!client) return undefined;
  try {
    return await bounded(() => run(client), client);
  } catch {
    count("cache.failure");
    return undefined;
  }
}

/** Cache only assembled metadata, never stream responses or private configuration. */
export function persistentLoader<T>(
  namespace: string,
  load: (key: string, previous?: T) => Promise<T>,
  accept: (value: T) => boolean,
  freshMs = 300_000,
) {
  const refreshing = new Map<string, Promise<T>>();
  const prefix = createHash("sha256")
    .update(
      Object.entries(process.env)
        .filter(([key]) => /_SOURCE_URL$/.test(key))
        .sort()
        .map(([key, value]) => `${key}=${value}`)
        .join("\n"),
    )
    .digest("hex")
    .slice(0, 16);
  const cacheKey = (key: string) =>
    `hanstream:v1:${prefix}:${namespace}:${createHash("sha256").update(key).digest("hex")}`;
  const remember = async (key: string, value: T) => {
    if (!accept(value)) return false;
    const raw = JSON.stringify({ version: 1, fetchedAt: Date.now(), value });
    if (Buffer.byteLength(raw) > MAX_BYTES) return false;
    const cache = await store();
    if (!cache) return false;
    try {
      await bounded(() => cache.set(cacheKey(key), raw, { EX: 86_400 }), cache);
      return true;
    } catch {
      count("cache.failure");
      return false;
    }
  };
  const read = async (key: string, previous?: T): Promise<T> => {
    const id = cacheKey(key);
    let saved = previous;
    let fetchedAt = 0;
    const cache = await store();
    if (!saved && cache) {
      try {
        const raw = await bounded(() => cache.get(id), cache);
        if (raw && Buffer.byteLength(raw) <= MAX_BYTES) {
          const entry = JSON.parse(raw);
          if (
            entry.version === 1 &&
            Number.isFinite(entry.fetchedAt) &&
            Date.now() - entry.fetchedAt >= 0 &&
            Date.now() - entry.fetchedAt < 86_400_000 &&
            accept(entry.value)
          ) {
            saved = entry.value;
            fetchedAt = entry.fetchedAt;
            count("cache.hit");
          }
        }
        if (!saved) count("cache.miss");
      } catch {
        count("cache.failure");
      }
    }
    const refresh = () => {
      let pending = refreshing.get(key);
      if (!pending) {
        pending = load(key, saved)
          .then((value) => {
            if (cache) void remember(key, value);
            return value;
          })
          .finally(() => refreshing.delete(key));
        refreshing.set(key, pending);
      }
      return pending;
    };
    if (saved && fetchedAt) {
      if (Date.now() - fetchedAt >= freshMs) void refresh().catch(() => {});
      return saved;
    }
    return refresh().catch((error) => {
      if (saved) return saved;
      throw error;
    });
  };
  return Object.assign(read, { remember });
}
