import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

const site = process.env.PERF_SITE_URL || 'http://localhost:3000';
const api = process.env.PERF_API_URL || site;
const checks = [['home', '/api/home'], ['search', `/api/search?q=${encodeURIComponent(process.env.PERF_SEARCH_QUERY || 'love')}`]];
if (process.env.PERF_DETAIL_PATH) checks.push(['detail', process.env.PERF_DETAIL_PATH]);
const report = { note: 'First request does not force a host cold start. Compare after real idle and while warm.', http: [] };
for (const [name, path] of checks) {
  for (const phase of ['first', 'warm']) {
    const start = performance.now();
    try {
      const response = await fetch(new URL(path, api), { signal: AbortSignal.timeout(90_000), headers: { 'Cache-Control': 'no-cache' } });
      const body = await response.arrayBuffer();
      report.http.push({ name, phase, status: response.status, ms: Math.round(performance.now() - start), bytes: body.byteLength, serverTiming: response.headers.get('server-timing') });
    } catch { report.http.push({ name, phase, error: 'Request failed or timed out' }); }
  }
}
if (!process.argv.includes('--http-only')) {
  const candidates = [process.env.PERF_BROWSER_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'];
  const executablePath = candidates.find(value => value && existsSync(value));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const phase of ['first', 'warm']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 100_000 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.addInitScript(() => {
        window.__perf = { lcp: null, firstPosterMs: null };
        document.addEventListener('load', event => {
          if (event.target instanceof HTMLImageElement && event.target.naturalWidth > 0 && window.__perf.firstPosterMs === null) window.__perf.firstPosterMs = performance.now();
        }, true);
        new PerformanceObserver(list => { window.__perf.lcp = list.getEntries().at(-1)?.startTime || null; }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      let errors = 0;
      page.on('pageerror', () => errors++);
      await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForFunction(() => [...document.images].some(image => image.complete && image.naturalWidth > 0), undefined, { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1000);
      report[phase] = await page.evaluate(() => ({ lcpMs: window.__perf.lcp && Math.round(window.__perf.lcp), firstPosterMs: window.__perf.firstPosterMs && Math.round(window.__perf.firstPosterMs), loadedImages: [...document.images].filter(image => image.complete && image.naturalWidth > 0).length, scriptBytes: performance.getEntriesByType('resource').filter(entry => entry.initiatorType === 'script').reduce((sum, entry) => sum + entry.transferSize, 0), horizontalOverflow: document.documentElement.scrollWidth > innerWidth }));
      report[phase].runtimeErrors = errors;
      await context.close();
    }
  } finally { await browser.close(); }
}
console.log(JSON.stringify(report, null, 2));
