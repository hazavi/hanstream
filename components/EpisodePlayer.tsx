"use client";

import { useState } from "react";
import { Server, Check } from "lucide-react";
import { MEDIA_SANDBOX, safeEmbedUrl } from '@/lib/embed';

export function EpisodePlayer({ video, servers = [], title }: { video: string; servers?: { name: string; url: string }[]; title: string }) {
  const [selected, setSelected] = useState(() => safeEmbedUrl(video));
  const availableServers = servers.filter(server => safeEmbedUrl(server.url));
  return <div className="space-y-3">

    <div className="aspect-video relative video-container">
      {selected ? <iframe key={selected} src={selected} title={title} sandbox={MEDIA_SANDBOX} className="h-full w-full rounded-2xl" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="no-referrer" /> : <div className="flex h-full items-center justify-center rounded-2xl glass-card p-6 text-center text-secondary">This episode is currently unavailable.</div>}
    </div>
    {availableServers.length > 0 && <div className="stream-server-controls" aria-label="Streaming servers"><span className="stream-server-label"><Server size={14} aria-hidden="true"/>Servers</span>{availableServers.map((server, index) => <button key={server.url} type="button" aria-pressed={selected === server.url} onClick={() => setSelected(safeEmbedUrl(server.url))} className="stream-server-button">{selected === server.url && <Check size={13} aria-hidden="true"/>}Server {index + 1}</button>)}</div>}
  </div>;
}
