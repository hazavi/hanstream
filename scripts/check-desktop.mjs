import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const addresses = [...new Set([process.env.DESKTOP_DEBUG_URL || 'http://localhost:9223', 'http://127.0.0.1:9223', 'http://[::1]:9223'])];
const started = Date.now();
let browser;
let lastError = '';
while (!browser && Date.now() - started < 90_000) {
  try {
    const address = addresses[Math.floor((Date.now() - started) / 1000) % addresses.length];
    const targets = await (await fetch(new URL('/json/list', address), { signal: AbortSignal.timeout(2000) })).json();
    if (!targets.some(target => target.type === 'page' && target.url.startsWith('https://tauri.localhost'))) throw new Error('Waiting for app document');
    browser = await chromium.connectOverCDP(address, { timeout: 5000 });
  } catch (error) { lastError = `${error.message} (${error.cause?.code || error.code || 'starting'})`; await new Promise(resolve => setTimeout(resolve, 1000)); }
}
assert.ok(browser, `Desktop WebView2 was not ready: ${lastError}`);
try {
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.waitForEvent('page', { timeout: 15_000 });
  await page.waitForURL('https://tauri.localhost/**', { timeout: 30_000 });
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
