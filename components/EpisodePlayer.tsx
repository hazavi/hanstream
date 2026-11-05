"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Server, Check, RotateCcw } from "lucide-react";
import { MEDIA_SANDBOX, safeEmbedUrl } from '@/lib/embed';
import {isDesktop} from '@/lib/native';
import {NativePlayer} from './NativePlayer';

export function EpisodePlayer({ video, servers = [], title, navigation, preferenceKey }: { video: string; servers?: { name: string; url: string }[]; title: string; navigation?: ReactNode; preferenceKey?: string }) {
  const [selected, setSelected] = useState(() => safeEmbedUrl(video));
  const [status,setStatus]=useState<'loading'|'ready'|'slow'|'failed'>('loading');
  const [reload,setReload]=useState(0);
  const [mode,setMode]=useState<'pending'|'desktop'|'web'>('pending');
  useEffect(()=>setMode(isDesktop()?'desktop':'web'),[]);
  const availableServers = servers.filter(server => safeEmbedUrl(server.url));
  const serverKey=JSON.stringify(availableServers.map(server=>server.url));
  useEffect(()=>{
    if(!preferenceKey)return;
    try{const saved=localStorage.getItem('hanstream-player-v2:'+preferenceKey);if(saved===null)return;const index=Number(saved);const values=JSON.parse(serverKey) as string[];if(Number.isInteger(index)&&index>=0&&values[index]){setStatus('loading');setSelected(values[index]);}}catch{/* Preferences never block playback. */}
  },[preferenceKey,serverKey]);
  useEffect(()=>{
    const timer=setTimeout(()=>setStatus(current=>current==='loading'?'slow':current),12_000);
    return()=>clearTimeout(timer);
  },[selected,reload]);
  function choose(index:number){const server=availableServers[index];if(!server)return;setStatus('loading');setSelected(safeEmbedUrl(server.url));setReload(value=>value+1);try{if(preferenceKey)localStorage.setItem('hanstream-player-v2:'+preferenceKey,String(index));}catch{/* Session selection still works. */}}
  return <div>

    <div className="aspect-video relative video-container">
      {selected ? mode==='desktop' ? <NativePlayer url={selected} reload={reload} title={title} onLoaded={()=>setStatus('ready')} onFailure={()=>setStatus('failed')}/> : mode==='web' ? <iframe key={selected+':'+reload} src={selected} title={title} sandbox={MEDIA_SANDBOX} className="h-full w-full rounded-2xl" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="no-referrer" onLoad={()=>setStatus('ready')} onError={()=>setStatus('failed')} /> : null : <div className="flex h-full items-center justify-center rounded-2xl glass-card p-6 text-center text-secondary">This episode is currently unavailable.</div>}
      {selected && status==='loading' && <div className="pointer-events-none absolute top-3 left-3 rounded-lg bg-black/80 px-3 py-2 text-xs text-white" role="status">Loading player...</div>}
    </div>
    {selected && (status==='slow'||status==='failed') && <p role="status" className="text-sm text-secondary py-3">The player has not loaded. Reload it or try another server below.</p>}
    {availableServers.length>1 && <p className="text-xs text-secondary mt-3">If a server shows an error or blocks playback, choose another server.</p>}
    {(availableServers.length > 0 || navigation) && <div className="watch-toolbar">
      {availableServers.length > 0 && <div className="stream-server-controls" aria-label="Streaming servers"><span className="stream-server-label"><Server size={14} aria-hidden="true"/><span className="stream-server-title">Servers</span></span>{availableServers.map((server, index) => <button key={server.url} type="button" aria-pressed={selected === server.url} onClick={() => choose(index)} className="stream-server-button">{selected === server.url && <Check size={13} aria-hidden="true"/>}Server {index + 1}</button>)}</div>}
      {selected && <button type="button" className="stream-server-button" aria-label="Reload player" onClick={()=>{setStatus('loading');setReload(value=>value+1);}}><RotateCcw size={14} aria-hidden="true"/></button>}
      {navigation}
    </div>}
  </div>;
}
