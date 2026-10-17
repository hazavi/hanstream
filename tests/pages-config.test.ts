// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getPagesConfig } from "../scripts/pages-config.mjs";

describe("Pages build connection configuration", () => {
  it("allows GitHub Actions to export the frontend before a backend URL is supplied", () => {
    expect(getPagesConfig({ GITHUB_ACTIONS: "true", PAGES_BASE_PATH: "/hanstream" })).toEqual({ api: "", basePath: "/hanstream" });
    expect(getPagesConfig({ NEXT_PUBLIC_API_BASE_URL: "  " }).api).toBe("");
  });

  it("accepts a public HTTPS origin and normalizes whitespace and trailing slashes", () => {
    expect(getPagesConfig({ NEXT_PUBLIC_API_BASE_URL: " https://backend.example/ ", PAGES_BASE_PATH: "/hanstream/" })).toEqual({ api: "https://backend.example", basePath: "/hanstream" });
  });

  it("rejects invalid non-empty URLs and local HTTP addresses in Actions", () => {
    for (const value of ["invalid", "http://backend.example", "https://user:password@backend.example", "https://backend.example/api", "https://backend.example?q=x", "https://backend.example#x", "http://localhost:3000"]) {
      expect(() => getPagesConfig({ GITHUB_ACTIONS: "true", NEXT_PUBLIC_API_BASE_URL: value })).toThrow("HTTPS origin");
    }
    expect(getPagesConfig({ NEXT_PUBLIC_API_BASE_URL: "http://localhost:3000" }).api).toBe("http://localhost:3000");
  });

  it("keeps asset base paths limited to the repository path", () => {
    expect(getPagesConfig({ PAGES_BASE_PATH: "/" }).basePath).toBe("");
    expect(() => getPagesConfig({ PAGES_BASE_PATH: "/../other" })).toThrow("repository path");
  });
});
