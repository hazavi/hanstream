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
  const saved = await page.evaluate(async () => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    const now = new Date().toISOString();
    const profile = {profilePicture:'avatar-1',watchlist:[{slug:'storage-check',title:'Storage check',status:'plan-to-watch',dateAdded:now}],continueWatching:[],topRankings:[],watchedEpisodes:{'storage-check':['s1e10']},createdAt:now,updatedAt:now};
    await invoke('library_save',{profile});
    await invoke('cache_save',{key:'smoke',value:{ok:true},expiresAt:Date.now()+60_000});
    return {profile:await invoke('library_load'),cache:await invoke('cache_load',{key:'smoke'})};
  });
  assert.equal(saved.profile.watchlist[0].title, 'Storage check');
  assert.equal(saved.cache.ok,true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText('Storage check',{exact:true}).first().waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('hanstream-local-profile')),null,'Desktop library must live in SQLite');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.getByRole('button', { name: 'Delete saved data' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Delete saved data' }).click();
  await page.getByRole('button', { name: 'Delete library', exact: true }).click();
  await page.getByText('Saved library and watch history deleted from this device.').waitFor();
  assert.equal(await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('library_load')),null);
  assert.equal(await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('cache_load',{key:'smoke'})),null);
  const escaped = await page.evaluate(async () => {
    location.href = 'https://example.com/';
    await new Promise(resolve => setTimeout(resolve, 500));
    return location.origin;
  }).catch(() => page.url());
  assert.ok(escaped.startsWith('https://tauri.localhost'), 'External top-level navigation was allowed');
  assert.equal(runtimeErrors, 0, 'Desktop UI raised a runtime error');
  console.log('Desktop WebView2 origin, hydration, SQLite save/reload/delete, bounded cache, theme, and navigation restriction passed.');
} finally { await browser.close(); }
