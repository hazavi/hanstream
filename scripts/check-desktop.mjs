import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import {checkNativeMedia} from './check-native-media.mjs';
import {spawn} from 'node:child_process';
import path from 'node:path';
if(!process.env.CI)throw new Error('Run desktop checks only in an isolated CI test environment.');

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
    await invoke('library_clear');
    localStorage.setItem('hanstream-local-profile',JSON.stringify(profile));
    await invoke('cache_save',{key:'smoke',value:{ok:true},expiresAt:Date.now()+60_000});
    return {cache:await invoke('cache_load',{key:'smoke'})};
  });
  assert.equal(saved.cache.ok,true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Open Plan to watch folder',exact:true}).click();
  await page.getByText('Storage check',{exact:true}).first().waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('hanstream-local-profile')),null,'Desktop library must live in SQLite');
  assert.equal((await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('library_load'))).watchlist[0].title,'Storage check','Existing library must migrate into SQLite');
  const nativeExport = async (name, cancel = false) => {
    const args = ['-NoProfile', '-NonInteractive', '-File', 'scripts/check-native-export.ps1', '-AppProcessId', process.env.HANSTREAM_TEST_PROCESS_ID, '-SavePath', path.join(process.env.RUNNER_TEMP, name)];
    if (cancel) args.push('-Cancel');
    const helper = spawn('powershell.exe', args, {windowsHide:true, stdio:['ignore','pipe','pipe']});
    let output = ''; helper.stdout.on('data', chunk => output += chunk); helper.stderr.on('data', chunk => output += chunk);
    const complete = new Promise((resolve,reject) => {helper.on('error',reject);helper.on('exit',code=>code===0?resolve():reject(new Error(output || 'Native export check failed')));});
    void complete.catch(()=>{});
    await page.getByRole('button',{name:'Export library',exact:true}).click();
    try { await complete; }
    catch (error) {
      const feedback = await page.getByRole('region',{name:'Manage saved library',exact:true}).innerText();
      throw new Error(`${error.message}\nApp export feedback: ${feedback}`, {cause:error});
    }
    await page.getByRole('button',{name:'Export library',exact:true}).waitFor();
    assert.ok(await page.getByRole('button',{name:'Export library',exact:true}).isEnabled());
  };
  await nativeExport('hanstream-export-first.json');
  await nativeExport('hanstream-export-cancelled.json', true);
  await nativeExport('hanstream-export-second.json');
  assert.equal((await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('library_load'))).watchlist.length,1,'Export changed the saved library');
  await page.getByText('Storage check',{exact:true}).first().hover();
  await page.getByRole('button',{name:'Remove Storage check from watchlist',exact:true}).click();
  await page.getByRole('alertdialog',{name:'Remove from watchlist?'}).waitFor();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal((await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('library_load'))).watchlist.length,1,'Cancelling removal changed the saved library');
  await page.getByRole('button',{name:'Remove Storage check from watchlist',exact:true}).click();
  await page.getByRole('button',{name:'Remove drama',exact:true}).click();
  await page.waitForFunction(async () => (await window.__TAURI_INTERNALS__.invoke('library_load')).watchlist.length === 0);
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.getByRole('button', { name: 'Delete saved data' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Delete saved data' }).click();
  await page.getByRole('button', { name: 'Delete library', exact: true }).click();
  await page.getByText('Saved library and watch history deleted from this device.').waitFor();
  assert.equal(await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('library_load')),null);
  assert.equal(await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('cache_load',{key:'smoke'})),null);
  const api=process.env.DESKTOP_API_BASE_URL;
  assert.ok(api,'Desktop check needs its configured backend address');
  const catalogKey=api.replace(/\/$/,'')+'/api/home';
  let catalogReads=0;
  const catalog={home:{reviews:[],trending:[],starting:[],ending:[]},recent:[{title:'Offline catalog check',image:'/file.svg','episode-link':'/drama-offline-check--2026/episode/s1e1',episode_number:1,time:'Available now',type:'Drama'}],popular:[],rankings:{lists:{airing:[],upcoming:[],popular:[]},errors:{}},partial:false};
  await page.route(catalogKey,route=>{
    catalogReads++;
    const data=catalogReads===1?{...catalog,partial:true,rankings:{lists:{airing:[],upcoming:[],popular:[]},errors:{airing:'Temporarily unavailable'}}}:{...catalog,rankings:{lists:{airing:[{title:'Recovered airing show',slug:'drama-recovered--2026',detail_link:'/drama-recovered--2026',image:'/file.svg',rank:1,release_year:2026}],upcoming:[],popular:[]},errors:{}}};
    return route.fulfill({json:data});
  });
  await page.goto('https://tauri.localhost/',{waitUntil:'domcontentloaded'});
  await page.getByText('Offline catalog check',{exact:true}).waitFor();
  await page.getByText('Recovered airing show',{exact:true}).waitFor({timeout:25_000});
  await page.waitForFunction(async key=>(await window.__TAURI_INTERNALS__.invoke('cache_load',{key}))?.value?.rankings?.lists?.airing?.[0]?.title==='Recovered airing show',catalogKey);
  await page.evaluate(async key=>{
    const record=await window.__TAURI_INTERNALS__.invoke('cache_load',{key});
    record.savedAt=Date.now()-3_600_000;record.expires=Date.now()+43_200_000;
    await window.__TAURI_INTERNALS__.invoke('cache_save',{key,value:record,expiresAt:record.expires});
  },catalogKey);
  await page.unroute(catalogKey);
  await page.route(api.replace(/\/$/,'')+'/api/**',route=>route.abort('internetdisconnected'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText('Offline catalog check',{exact:true}).waitFor({timeout:8000});
  await page.getByText('Recovered airing show',{exact:true}).waitFor({timeout:8000});
  await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('library_clear'));
  await checkNativeMedia(page,api);
  const escaped = await page.evaluate(async () => {
    location.href = 'https://example.com/';
    await new Promise(resolve => setTimeout(resolve, 500));
    return location.origin;
  }).catch(() => page.url());
  assert.ok(escaped.startsWith('https://tauri.localhost'), 'External top-level navigation was allowed');
  assert.equal(runtimeErrors, 0, 'Desktop UI raised a runtime error');
  // Leave a child player alive. The workflow closes the native main window and
  // requires the process to exit, covering the invisible-process uninstall bug.
  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('media_open', {
    session: crypto.randomUUID().replaceAll('-', ''), url: 'https://media.example/player',
    x: 0, y: 0, width: 300, height: 200,
  }));
  console.log('Desktop WebView2 origin, hydration, SQLite save/reload/delete, bounded cache, live partial-home recovery, offline catalog reopen, theme, and navigation restriction passed.');
} finally { await browser.close(); }
