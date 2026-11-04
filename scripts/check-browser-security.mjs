import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

const url = process.env.SECURITY_TEST_URL || 'http://127.0.0.1:3100/profile';
const path = process.env.PERF_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(path) ? { executablePath: path } : {}) });
try {
  const page = await browser.newPage();
  let errors = 0; page.on('pageerror', () => errors++);
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  const policy = response.headers()['content-security-policy'];
  assert.match(policy, /script-src[^;]*nonce-/);
  assert.doesNotMatch(policy, /script-src[^;]*unsafe-(?:inline|eval)/);
  const toggle = page.getByRole('button', { name: 'Switch to light mode' });
  await toggle.click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
  assert.equal(errors, 0, 'Next hydration must succeed under the nonce policy');
  const blocked = await page.evaluate(async () => {
    window.__unapprovedScript = false;
    const script = document.createElement('script'); script.textContent = 'window.__unapprovedScript = true'; document.body.append(script);
    await new Promise(resolve => setTimeout(resolve, 50));
    return window.__unapprovedScript === false;
  });
  assert.equal(blocked, true, 'Unapproved inline scripts must be blocked');
  console.log('Production nonce policy, hydration, theme interaction, and inline-script blocking passed.');
} finally { await browser.close(); }
