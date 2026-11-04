import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const address = process.env.DESKTOP_DEBUG_URL || 'http://127.0.0.1:9223';
const started = Date.now();
let browser;
while (!browser && Date.now() - started < 60_000) {
  try { browser = await chromium.connectOverCDP(address, { timeout: 3000 }); }
  catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
}
assert.ok(browser, 'Desktop WebView2 debugging endpoint did not start');
try {
  const context = browser.contexts()[0];
  const page = context.pages().find(page => page.url().startsWith('https://tauri.localhost')) || await context.waitForEvent('page', { timeout: 15_000 });
  assert.equal(new URL(page.url()).origin, 'https://tauri.localhost');
  let runtimeErrors = 0; page.on('pageerror', () => runtimeErrors++);
  await page.goto('https://tauri.localhost/profile/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'My Library', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Export library', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.getByRole('button', { name: 'Delete saved data' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const escaped = await page.evaluate(async () => {
    location.href = 'https://example.com/';
    await new Promise(resolve => setTimeout(resolve, 500));
    return location.origin;
  }).catch(() => page.url());
  assert.ok(escaped.startsWith('https://tauri.localhost'), 'External top-level navigation was allowed');
  assert.equal(runtimeErrors, 0, 'Desktop UI raised a runtime error');
  console.log('Desktop WebView2 origin, local assets, hydration, theme, library controls, and navigation restriction passed.');
} finally { await browser.close(); }
