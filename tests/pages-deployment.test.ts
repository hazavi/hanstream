import { describe, expect, it } from "vitest";
import { allowedFrontend } from "../lib/cors";
import { pagesRoute } from "../lib/pages-routes";

describe("static hosting routes", () => {
  it("keeps detail and episode links refreshable without a server rewrite", () => {
    expect(pagesRoute("/drama-some-show--2026")).toBe("/drama/?id=drama-some-show--2026");
    expect(pagesRoute("/film-some-film--2026/episode/1")).toBe("/watch/?id=film-some-film--2026&episode=1");
    expect(pagesRoute("/drama-some-show--2026/episode/s1e2")).toBe("/watch/?id=drama-some-show--2026&episode=s1e2");
    expect(pagesRoute("/search?q=hello&page=2")).toBe("/search?q=hello&page=2");
    expect(pagesRoute("/profile")).toBe("/profile");
    expect(pagesRoute("/1234")).toBe("/drama/?id=1234");
    expect(pagesRoute("/movie-1234/episode/1")).toBe("/watch/?id=movie-1234&episode=1");
  });
});
describe("backend CORS", () => {
  const list = "https://hazavi.github.io,http://localhost:4173";
  it("allows only configured exact origins", () => {
    expect(allowedFrontend("https://hazavi.github.io", list)).toBe(true);
    expect(allowedFrontend("http://localhost:4173", list)).toBe(true);
    expect(allowedFrontend("https://hazavi.github.io.evil.example", list)).toBe(false);
    expect(allowedFrontend("https://other.github.io", list)).toBe(false);
    expect(allowedFrontend("https://hazavi.github.io", "*")).toBe(false);
    expect(allowedFrontend("https://hazavi.github.io", "https://hazavi.github.io/hanstream")).toBe(false);
    expect(allowedFrontend("https://hazavi.github.io", "")).toBe(false);
  });
});
