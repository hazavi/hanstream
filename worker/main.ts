import { createServer } from "node:http";
import { getSourceConfig } from "../lib/server-config.mjs";
import { startReaderWorker } from "./runner";
import { enqueueReader } from "../lib/reader-queue";
getSourceConfig();
const worker = await startReaderWorker();
// Refresh a small public homepage snapshot even when no browser is open.
const warm = () => {
  void enqueueReader({ kind: "home" }).catch(() => {});
};
warm();
const warmTimer = setInterval(warm, 60_000);
warmTimer.unref();
const port = Number(process.env.PORT || 3101);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid reader port.");
const server = createServer((request, response) => {
  if (
    !["GET", "HEAD"].includes(request.method || "") ||
    !["/health", "/api/health"].includes(request.url || "")
  ) {
    response.writeHead(404, { "Cache-Control": "no-store" });
    response.end();
    return;
  }
  response.writeHead(worker.ready() ? 200 : 503, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(
    JSON.stringify({
      status: worker.ready() ? "ok" : "starting",
      role: "reader",
    }),
  );
});
server.listen(port, "0.0.0.0", () => console.log("Source reader started."));
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    clearInterval(warmTimer);
    server.close();
    void worker.stop().finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
