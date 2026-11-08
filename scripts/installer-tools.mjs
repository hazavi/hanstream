import {createHash} from 'node:crypto';
import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Pins match the official assets for the installed Tauri CLI 2.12.4.
const assets = [
  {name:'nsis-3.13.zip', repository:'tauri-apps/binary-releases', tag:'nsis-3.13', id:623832696, sha256:'ba63dffc4410ee89193e1cb5a41989991bd77c61068da17e3156d136b7b0b3d8'},
  {name:'nsis_tauri_utils.dll', repository:'tauri-apps/nsis-tauri-utils', tag:'nsis_tauri_utils-v0.5.3', id:345882097, sha256:'5ba143b5db4a87d32d6e7802e033330aae56cbceabe0d1e3ba41948385ad4709'},
];
const root = fileURLToPath(new URL('../',import.meta.url));
const directory = path.join(root,'.tools','installer-tools');
const digest = data => createHash('sha256').update(data).digest('hex');

async function download(asset) {
  const file = path.join(directory,asset.name);
  if (await readFile(file).then(data=>digest(data)===asset.sha256).catch(()=>false)) return file;
  for(let attempt=0;attempt<4;attempt++) {
    let response;
    try {
      const api = attempt > 0;
      // A fresh signed asset URL avoids cached failures on the release download URL.
      const url = api ? `https://api.github.com/repos/${asset.repository}/releases/assets/${asset.id}` : `https://github.com/${asset.repository}/releases/download/${asset.tag}/${asset.name}`;
      const headers = api ? {Accept:'application/octet-stream',...(process.env.GITHUB_TOKEN?{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`}:{})} : {};
      response = await fetch(url+'?download='+Date.now(),{headers,signal:AbortSignal.timeout(20000)});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      if(Number(response.headers.get('content-length'))>5000000) throw new Error('Oversized installer tool');
      const reader=response.body.getReader(),parts=[];let size=0;
      for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>5000000){await reader.cancel();throw new Error('Oversized installer tool');}parts.push(part.value);}
      const data=Buffer.concat(parts);
      if(digest(data)!==asset.sha256) throw new Error('Installer tool checksum mismatch');
      await writeFile(file,data);return file;
    } catch (error) {
      await response?.body?.cancel().catch(()=>{});
      console.warn('Installer tool download did not complete:', /^(?:HTTP \d+|Oversized installer tool|Installer tool checksum mismatch)$/.test(error.message) ? error.message : error.name);
      if(attempt===3) throw new Error(`Unable to download and verify ${asset.name}. Retry the installer build.`);
      console.log(`Retrying verified installer tool download (${attempt+1}/3).`);
      await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
    }
  }
}

export async function prepareInstallerTools(downloadOnly=false) {
  if(process.platform!=='win32'&&!downloadOnly) return;
  await mkdir(directory,{recursive:true});
  const archive=await download(assets[0]),plugin=await download(assets[1]);
  if(downloadOnly){console.log('Official installer archive and plugin SHA-256 checks passed.');return;}
  const target=path.join(root,'src-tauri','target','.tauri','NSIS');
  const expanded=path.join(directory,'expanded');
  await mkdir(target,{recursive:true});
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(expanded)} -Force`],{stdio:'inherit',windowsHide:true});
  if(result.status!==0) throw new Error('Unable to extract the verified installer tools.');
  await cp(path.join(expanded,'nsis-3.13'),target,{recursive:true,force:true});
  const plugins=path.join(target,'Plugins','x86-unicode','additional');await mkdir(plugins,{recursive:true});
  await cp(plugin,path.join(plugins,assets[1].name));
  console.log('Prepared checksum-verified Windows installer tools.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await prepareInstallerTools(process.argv.includes('--download-only'));
