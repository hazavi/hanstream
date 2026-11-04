"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import type { DramaDetail, EpisodeResult } from "@/lib/api-types";
import { EpisodePlayer } from "./EpisodePlayer";
import { EpisodeList } from "./EpisodeList";
import { EpisodeProgressTracker } from "./EpisodeProgressTracker";
import { VideoControls } from "./VideoControls";
import { formatEpisodeLabel } from "@/lib/format";

export function WatchPage({ result, drama, slug, episode }: { result: EpisodeResult; drama?: DramaDetail; slug: string; episode: string }) {
  const frameRoot = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState(0);
  const [override, setOverride] = useState<{ episode: string; result: EpisodeResult }>();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const playback = override?.episode === episode ? override.result : result;
  const episodes = useMemo(() => playback.episodes?.filter((item): item is typeof item & { id: string } => Boolean(item.id)) || [], [playback.episodes]);
  const playable = episodes.filter(item => item.available !== false && (!item.time || Date.parse(item.time) <= Date.now()));
  const selectedEpisode = playback.current_episode || episode;
  const current = episodes.find(item => item.id === selectedEpisode);
  const title = drama?.title || result.category?.title || "Drama";
  useEffect(() => {
    const frame = frameRoot.current?.querySelector(".video-container");
    if (!frame) return;
    const resize = () => { const height = Math.round(frame.getBoundingClientRect().height); if (height > 0) setFrameHeight(height); };
    resize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : undefined;
    observer?.observe(frame);
    window.addEventListener("resize", resize);
    return () => { observer?.disconnect(); window.removeEventListener("resize", resize); };
  }, [episode, playback.video]);
  async function retryEpisode() {
    setRetrying(true); setRetryError("");
    try {
      const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
      const response = await fetch(`${base}/api/episode/${encodeURIComponent(slug)}/${encodeURIComponent(episode)}`, { credentials: "omit", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error();
      const data = await response.json() as { result: EpisodeResult };
      setOverride({ episode, result: data.result });
      if (!data.result.video) setRetryError("This episode is still unavailable. Try another episode or retry shortly.");
    } catch { setRetryError("Unable to reload the episode. Please try again."); }
    finally { setRetrying(false); }
  }
  return <div className="watch-page animate-fade-in">
    <header className="watch-heading"><Link href={`/${slug}`} className="text-sm text-secondary hover:text-primary inline-flex items-center gap-2"><ArrowLeft size={16} aria-hidden="true"/>{title}</Link><h1 className="heading text-xl sm:text-2xl font-semibold">{formatEpisodeLabel(episode)}{current?.title && <span className="font-normal text-secondary"> · {current.title}</span>}</h1></header>
    <div className="watch-layout" style={frameHeight ? { "--watch-frame-height": frameHeight + "px" } as CSSProperties : undefined}><div ref={frameRoot} className="watch-primary">
      <EpisodePlayer key={`${slug}/${episode}/${playback.video}`} video={playback.video} servers={playback.servers} title={playback.title} />
      {!playback.video && <div className="flex items-center gap-3 py-3"><button type="button" className="glass-btn text-sm inline-flex items-center gap-2" onClick={retryEpisode} disabled={retrying}><RotateCcw size={14} aria-hidden="true" className={retrying ? "animate-spin" : ""}/>{retrying ? "Reloading…" : "Retry episode"}</button>{retryError && <p role="status" className="text-xs text-secondary">{retryError}</p>}</div>}
      <div className="watch-toolbar"><span className="text-xs text-secondary">{formatEpisodeLabel(selectedEpisode)}</span><VideoControls episodes={playable} currentEpisode={selectedEpisode} slug={slug} /></div>
      {current?.description && <section className="watch-summary"><h2 className="heading text-sm font-semibold mb-2">About this episode</h2><p className="text-sm text-secondary leading-relaxed">{current.description}</p></section>}
      <EpisodeProgressTracker slug={slug} episode={selectedEpisode} title={title} image={drama?.image} totalEpisodes={playable.length} />
    </div><EpisodeList episodes={episodes} currentEpisode={selectedEpisode} slug={slug} poster={drama?.image} coverTitle={title} coverYear={Number(drama?.meta?.Released) || undefined} /></div>
  </div>;
}
