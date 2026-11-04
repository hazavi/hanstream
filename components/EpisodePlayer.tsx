"use client";

import { useState } from "react";
import { Server, Check } from "lucide-react";

export function EpisodePlayer({ video, servers = [], title }: { video: string; servers?: { name: string; url: string }[]; title: string }) {
  const [selected, setSelected] = useState(video);
  return <div className="space-y-3">

    <div className="aspect-video relative video-container">
      {selected ? <iframe key={selected} src={selected} title={title} className="h-full w-full rounded-2xl" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="no-referrer" /> : <div className="flex h-full items-center justify-center rounded-2xl glass-card p-6 text-center text-secondary">This episode is currently unavailable.</div>}
    </div>
    {servers.length > 0 && <div className="stream-server-controls" aria-label="Streaming servers"><span className="stream-server-label"><Server size={14} aria-hidden="true"/>Servers</span>{servers.map((server, index) => <button key={server.url} type="button" aria-pressed={selected === server.url} onClick={() => setSelected(server.url)} className="stream-server-button">{selected === server.url && <Check size={13} aria-hidden="true"/>}Server {index + 1}</button>)}</div>}
  </div>;
}
