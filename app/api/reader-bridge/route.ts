import { bridgeAllowed } from "@/lib/reader-bridge-auth";
import { parseReaderJob } from "@/lib/reader-protocol";
import { readerNamespace } from "@/lib/deployment";
import { requestCachedReader, readerKeys } from "@/lib/reader-queue";
import { readerErrorResponse } from "@/lib/reader-response";
import { cacheCommand } from "@/lib/persistent-cache";
import { startConfiguredReader } from "@reader/runtime";
export const dynamic = "force-dynamic";
const hidden = () =>
  new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  if (!bridgeAllowed(request)) return hidden();
  try {
    const worker = await startConfiguredReader();
    const heartbeat = await cacheCommand((client) =>
      client.get(readerNamespace() + ":heartbeat"),
    );
    const queued = await cacheCommand((client) =>
      client.eval(
        "return {redis.call('XLEN',KEYS[1]),redis.call('XLEN',KEYS[2]),redis.call('XLEN',KEYS[3])}",
        {
          keys: [
            readerNamespace() + ":urgent",
            readerNamespace() + ":normal",
            readerNamespace() + ":images",
          ],
          arguments: [],
        },
      ),
    );
    return Response.json(
      {
        role: "reader",
        namespace: readerNamespace(),
        cacheReady: heartbeat !== undefined,
        readerReady: worker.ready() && Boolean(heartbeat),
        queued: Array.isArray(queued)
          ? {
              playback: Number(queued[0]),
              metadata: Number(queued[1]),
              images: Number(queued[2]),
            }
          : undefined,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
export async function POST(request: Request) {
  if (!bridgeAllowed(request)) return hidden();
  let job;
  try {
    const stream = request.body?.getReader();
    if (!stream) throw Error();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await stream.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 2048) {
        await stream.cancel();
        throw Error();
      }
      chunks.push(part.value);
    }
    job = parseReaderJob(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    return new Response(null, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }
  try {
    await startConfiguredReader();
    const value = await requestCachedReader(job);
    return Response.json(
      {
        version: 1,
        namespace: readerNamespace(),
        id: readerKeys(job).id,
        value,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return readerErrorResponse(error);
  }
}
