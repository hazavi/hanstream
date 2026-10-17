"use client";

import { useState } from "react";

export function EpisodePlayer({ video, servers = [], title }: { video: string; servers?: { name: string; url: string }[]; title: string }) {
  const [selected, setSelected] = useState(video);
  return <div className="space-y-3">
    {servers.length > 1 && <div className="flex flex-wrap items-center gap-2" aria-label="Streaming servers">{servers.map((server, index) => <button key={server.url} type="button" aria-pressed={selected === server.url} onClick={() => setSelected(server.url)} className="glass-btn px-3 py-2 text-xs">Server {index + 1}</button>)}</div>}
    <div className="aspect-video relative video-container">
      {selected ? <iframe key={selected} src={selected} title={title} className="h-full w-full rounded-2xl" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="no-referrer" /> : <div className="flex h-full items-center justify-center rounded-2xl glass-card p-6 text-center text-secondary">This episode is currently unavailable.</div>}
    </div>
  </div>;
}
