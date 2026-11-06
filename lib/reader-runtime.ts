import "server-only";
import { webRuntime } from "./deployment";
import { startReaderWorker } from "../worker/runner";
import { enqueueReader } from "./reader-queue";
type Running = Awaited<ReturnType<typeof startReaderWorker>>;
const state = globalThis as typeof globalThis & {
  __hanstreamReader?: Promise<Running>;
};
export function startConfiguredReader() {
  if (
    webRuntime() ||
    !process.env.READER_GATEWAY_SECRET ||
    !process.env.CACHE_URL
  )
    throw new Error("Private reader is not configured.");
  if (!state.__hanstreamReader)
    state.__hanstreamReader = startReaderWorker()
      .then((worker) => {
        const warm = () => {
          void enqueueReader({ kind: "home" }).catch(() => {});
        };
        warm();
        setInterval(warm, 60_000).unref();
        return worker;
      })
      .catch((error) => {
        state.__hanstreamReader = undefined;
        throw error;
      });
  return state.__hanstreamReader;
}
