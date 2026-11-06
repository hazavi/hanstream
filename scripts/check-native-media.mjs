import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

export async function checkNativeMedia(page,api) {
  await page.unroute(api.replace(/\/$/,'')+'/api/**');
  await page.route(api.replace(/\/$/,'')+'/api/episode/**',route=>route.fulfill({json:{result:{title:'Media isolation check',video:'https://media.example/player',servers:[{name:'One',url:'https://media.example/player'}],current_episode:'s1e1',episodes:[]}}}));
  await page.route(api.replace(/\/$/,'')+'/api/drama/**',route=>route.fulfill({json:{result:{title:'Media isolation check',image:'/file.svg',description:'Media fixture',meta:{},episodes:[]}}}));
  await page.goto('https://tauri.localhost/watch/?id=drama-media-check--2026&episode=s1e1',{waitUntil:'domcontentloaded'});
  await page.locator('[data-native-player]').waitFor({timeout:20000});
  assert.equal(await page.locator('iframe').count(),0,'Desktop player must use its isolated native surface');
  let mediaBrowser,lastError='';
  const deadline=Date.now()+30000;
  while(!mediaBrowser&&Date.now()<deadline){try{mediaBrowser=await chromium.connectOverCDP('http://127.0.0.1:9224',{timeout:2000});}catch(error){lastError=error.message;await new Promise(resolve=>setTimeout(resolve,500));}}
  assert.ok(mediaBrowser,'Media browser did not start: '+lastError);
  try {
    const context=mediaBrowser.contexts()[0];
    await context.route('https://media.example/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:black"><video autoplay muted playsinline style="width:100vw;height:100vh"></video><script>const canvas=document.createElement("canvas");canvas.width=160;canvas.height=90;const draw=canvas.getContext("2d");setInterval(()=>{draw.fillStyle="white";draw.fillRect(0,0,160,90);},100);const video=document.querySelector("video");video.srcObject=canvas.captureStream(10);video.play();</script></body></html>'}));
    const media=context.pages()[0]||await context.waitForEvent('page');
    await media.goto('https://media.example/player',{waitUntil:'domcontentloaded'});
    await media.waitForFunction(()=>document.querySelector('video')?.currentTime>0.5,{timeout:10000});
    const access=await media.evaluate(async()=>{
      const invoke=window.__TAURI_INTERNALS__?.invoke;if(!invoke)return 'no bridge';
      try{await invoke('library_load');return 'granted';}catch{return 'denied';}
    });
    assert.notEqual(access,'granted','Remote media gained library access');
    assert.equal(await media.evaluate(()=>Boolean(window.open('https://example.com/'))),false,'Media popup was allowed');
    assert.equal(await media.evaluate(()=>Object.getOwnPropertyDescriptor(window,'open')?.writable),false,'Popup guard did not run before player scripts');
    // Known advertising rules are checked at native automation startup. Use a
    // reserved literal address here so browser tracker lists cannot mask interception.
    // Do not mock this request: DevTools fulfillment can override a native response.
    const probe='https://203.0.113.1/player-protection-check.js';
    const blockedResponse=media.waitForResponse(response=>response.url()===probe,{timeout:10000});
    const [advertising,protectedResponse]=await Promise.all([
      media.evaluate(url=>new Promise(resolve=>{const script=document.createElement('script');script.src=url;script.onload=()=>resolve('loaded');script.onerror=()=>resolve('blocked');document.head.append(script);}),probe),
      blockedResponse,
    ]);
    assert.equal(advertising,'blocked','Known advertising request was not blocked');
    assert.equal(protectedResponse.status(),403);
    assert.equal(protectedResponse.headers()['x-hanstream-blocked'],'1','The request did not pass through the native filter');
    assert.equal(await media.evaluate(()=>Boolean(window.advertisingScriptExecuted)),false,'Advertising script executed');
    await media.evaluate(()=>window.close());
    assert.equal(media.isClosed(),false,'Remote player was able to close its host');
    const denied=await page.evaluate(async()=>{try{await window.__TAURI_INTERNALS__.invoke('media_open',{session:crypto.randomUUID().replaceAll('-',''),url:'https://example.com/',x:0,y:0,width:300,height:200});return false;}catch{return true;}});
    assert.ok(denied,'An unapproved media origin was accepted');
    const closed=media.waitForEvent('close',{timeout:10000});
    await page.goto('https://tauri.localhost/profile/',{waitUntil:'domcontentloaded'});
    await closed;
    await page.getByRole('heading',{name:'My Library',exact:true}).waitFor();
    console.log('Native playback, ad-request filtering, popup/close guards, library isolation, origin restriction, and navigation cleanup passed.');
  } finally {await mediaBrowser.close().catch(()=>{});}
}
