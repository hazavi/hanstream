import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { buildPlayerShield } from "./build-player-shield.mjs";

const folder = path.resolve(".tools/shield-check");
await buildPlayerShield(
  { PLAYER_ORIGINS: "https://media.example" },
  { outDir: folder, zipPath: ".tools/shield-check.zip" },
);
const manifest = JSON.parse(
  await readFile(path.join(folder, "manifest.json"), "utf8"),
);
assert.deepEqual(manifest.host_permissions, ["https://media.example/*"]);
assert.deepEqual(manifest.permissions, ["declarativeNetRequest"]);
const context = await chromium.launchPersistentContext(
  path.resolve(".tools/shield-profile"),
  {
    channel: "chromium",
    headless: true,
    args: [
      "--disable-extensions-except=" + folder,
      "--load-extension=" + folder,
    ],
  },
);
try {
  await context.route("https://media.example/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Player fixture</title>",
    }),
  );
  await context.route("https://ad.doubleclick.net/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "window.adExecuted=true;",
    }),
  );
  await context.route("https://content.example/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "window.mediaExecuted=true;",
    }),
  );
  const page = await context.newPage();
  await page.goto("https://media.example/player");
  assert.equal(
    await page.evaluate(() => Boolean(window.open("https://example.com"))),
    false,
  );
  const script = async (url) =>
    page.evaluate(
      (src) =>
        new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = src;
          script.onload = () => resolve("loaded");
          script.onerror = () => resolve("blocked");
          document.head.append(script);
        }),
      url,
    );
  assert.equal(
    await script("https://ad.doubleclick.net/protection-check.js"),
    "blocked",
    "Advertising request was allowed",
  );
  assert.equal(await page.evaluate(() => window.adExecuted), undefined);
  assert.equal(
    await script("https://content.example/media-check.js"),
    "loaded",
    "Normal player dependency was blocked",
  );
  assert.equal(await page.evaluate(() => window.mediaExecuted), true);
  await context.route("https://unrelated.example/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Unrelated fixture</title>",
    }),
  );
  await page.goto("https://unrelated.example/");
  assert.equal(
    await script("https://ad.doubleclick.net/outside-check.js"),
    "loaded",
    "Filtering escaped the player scope",
  );
  console.log(
    "Browser player protection passed: ad blocking, popup prevention, normal media dependencies, and limited scope.",
  );
} finally {
  await context.close();
}
