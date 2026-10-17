import { afterEach, expect, it, vi } from "vitest";
import { fetchSearchClient, readBackend } from "../lib/pages-client";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("calls the configured backend with an abort signal and no cookies", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://backend.example/");
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) });
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  expect(await readBackend("/api/health", signal)).toEqual({ status: "ok" });
  expect(fetch).toHaveBeenCalledWith("https://backend.example/api/health", { signal, credentials: "omit" });
});
it("maps search suggestions to static detail routes", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://backend.example");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ title: "A Show", image: "/file.svg", "detail-link": "/drama-a-show--2026" }] }) }));
  expect((await fetchSearchClient("a show")).results[0]["detail-link"]).toBe("/drama/?id=drama-a-show--2026");
});
it("shows a readable failure for a missing configuration or unavailable service", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
  await expect(readBackend("/api/home")).rejects.toThrow("not been configured");
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://backend.example");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  await expect(readBackend("/api/home")).rejects.toThrow("Please try again");
});
