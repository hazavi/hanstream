import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { workerPlugin } from "./build-reader.mjs";

// Exercise the real Redis Streams implementation, with deterministic source fixtures.
await mkdir(".tools", { recursive: true });
await writeFile(
  ".tools/reader-check.ts",
  `
import assert from 'node:assert/strict';
import {createClient} from 'redis';
import {randomUUID} from 'node:crypto';
import {startReaderWorker} from '../worker/runner';
import {requestReader,enqueueReader,readerKeys,ReaderPending,ReaderUnavailable} from '../lib/reader-queue';
import {parseReaderJob} from '../lib/reader-protocol';
import {readerNamespace} from '../lib/deployment';
import {cacheCommand} from '../lib/persistent-cache';

process.env.READER_NAMESPACE='check-'+randomUUID();
delete process.env.VERCEL;process.env.HANSTREAM_ROLE='reader';
const redis=createClient({url:process.env.CACHE_URL,socket:{connectTimeout:1000,reconnectStrategy:false}});redis.on('error',()=>{});await redis.connect();
let release;const blocked=new Promise(resolve=>{release=resolve;});let normalStarted=0,calls=0;
let worker;
async function eventually(task,timeout=10_000){const end=Date.now()+timeout;while(true){try{return await task();}catch(error){if(Date.now()>end)throw error;await new Promise(r=>setTimeout(r,25));}}}
try{
 assert.throws(()=>parseReaderJob({kind:'fetch',url:'https://127.0.0.1/'}));
 assert.throws(()=>parseReaderJob({kind:'drama',slug:'../private'}));
 assert.throws(()=>parseReaderJob({kind:'search',query:'x',page:Infinity}));
 assert.deepEqual(parseReaderJob({kind:'home',url:'https://untrusted.invalid'}),{kind:'home'});
 await Promise.all(Array.from({length:20},()=>enqueueReader({kind:'home'})));
 assert.equal(await redis.xLen(readerNamespace()+':normal'),1,'Concurrent requests were not deduplicated');
 worker=await startReaderWorker({blockMs:100,execute:async job=>{
  calls++;
  if(job.kind==='recent'){normalStarted++;await blocked;return {results:[{title:'Fixture'}]};}
  if(job.kind==='search')throw Error('private source failure');
  if(job.kind==='episode')return {result:{title:'Fixture',video:'https://media.example/player'}};
  return {fixture:true};
 }});
 process.env.HANSTREAM_ROLE='web';
 const home=await eventually(()=>requestReader({kind:'home'}));assert.deepEqual(home,{fixture:true});
 const count=calls;assert.deepEqual(await requestReader({kind:'home'}),home);assert.equal(calls,count,'Fresh cache refetched');
 await enqueueReader({kind:'recent',page:1});await enqueueReader({kind:'recent',page:2});
 await eventually(async()=>assert.equal(normalStarted,2));
 const episode={kind:'episode',slug:'drama-fixture--2026',episode:'s1e10'} as const;
 const start=Date.now();const playback=await eventually(()=>requestReader(episode));
 assert.equal(playback.result.video,'https://media.example/player');assert.ok(Date.now()-start<3000,'Playback waited behind metadata');
 assert.ok(await redis.ttl(readerKeys(episode).result)<=60,'Playback survived its short IPC TTL');
 release();
 await assert.rejects(eventually(()=>requestReader({kind:'search',query:'Fixture',page:1}),500),ReaderUnavailable);
 const stale=readerKeys({kind:'home'});
 await redis.set(stale.result,JSON.stringify({version:1,id:stale.id,fetchedAt:Date.now()-31_000,value:{saved:true}}),{EX:60});
 assert.deepEqual(await requestReader({kind:'home'}),{saved:true},'Stale metadata was discarded during refresh');
 await worker.stop();worker=undefined;
 const invalid={version:1,id:'forged',createdAt:Date.now(),job:{kind:'home'}};
 await redis.xAdd(readerNamespace()+':normal','*',{payload:JSON.stringify(invalid)});
 process.env.HANSTREAM_ROLE='reader';
 worker=await startReaderWorker({blockMs:100,execute:async()=>{throw Error('Unexpected job');}});
 await eventually(async()=>assert.equal(await redis.xLen(readerNamespace()+':normal'),0));
 console.log('Reader checks passed: validation, deduplication, cache hits, priority playback, short playback TTL, stale metadata, failure isolation, invalid-envelope cleanup.');
}finally{
 release();await worker?.stop();
 const keys=[];for await(const batch of redis.scanIterator({MATCH:readerNamespace()+':*',COUNT:100}))keys.push(...batch);
 if(keys.length)await redis.del(keys);
 await redis.quit();await cacheCommand(async client=>{client.destroy();return true;});
}
`,
);
await build({
  entryPoints: [".tools/reader-check.ts"],
  outfile: ".tools/reader-check.mjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  packages: "external",
  plugins: [workerPlugin],
});
const run = spawnSync(process.execPath, [".tools/reader-check.mjs"], {
  stdio: "inherit",
  env: process.env,
});
if (run.status !== 0) process.exitCode = run.status || 1;
