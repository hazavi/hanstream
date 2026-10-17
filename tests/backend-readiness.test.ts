// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "../app/api/health/route";
import { checkBackend } from "../scripts/check-backend.mjs";

afterEach(() => { vi.unstubAllEnvs(); });
const origin = "https://hazavi.github.io";
const response = (body: unknown, cors = origin) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": cors } });

it("reports missing configuration as not ready without exposing values", async () => {
  expect(GET().status).toBe(200);
  vi.stubEnv("STREAM_SOURCE_URL", "");
  const result = GET();
  expect(result.status).toBe(503);
  expect(await result.json()).toEqual({ status: "not_ready", error: "Backend configuration is incomplete." });
});

it("checks both browser access and actual catalog content", async () => {
  const request = vi.fn().mockResolvedValueOnce(response({ status: "ok" })).mockResolvedValueOnce(response({ recent: [{ title: "Live title" }], home: { reviews: [], trending: [], starting: [], ending: [] } }));
  expect(await checkBackend("https://backend.example", origin, request)).toEqual({ recent: 1 });
  expect(request.mock.calls.map(([url]) => url)).toEqual(["https://backend.example/api/health", "https://backend.example/api/home"]);
});

it("refuses to connect a healthy service that cannot be read by Pages", async () => {
  await expect(checkBackend("https://backend.example", origin, vi.fn().mockResolvedValue(response({ status: "ok" }, "")))).rejects.toThrow("FRONTEND_ORIGINS");
});

it("refuses to connect an empty catalog or the wrong service", async () => {
  const request = vi.fn().mockResolvedValueOnce(response({ status: "ok" })).mockResolvedValueOnce(response({ recent: [] }));
  await expect(checkBackend("https://backend.example", origin, request)).rejects.toThrow("homepage catalog");
});
