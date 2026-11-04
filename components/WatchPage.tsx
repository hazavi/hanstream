"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DramaDetail, EpisodeResult } from "@/lib/api-types";
import { EpisodePlayer } from "./EpisodePlayer";
import { EpisodeList } from "./EpisodeList";
import { EpisodeProgressTracker } from "./EpisodeProgressTracker";
import { VideoControls } from "./VideoControls";
import { formatEpisodeLabel } from "@/lib/format";

export function WatchPage({ result, drama, slug, episode }: { result: EpisodeResult; drama?: DramaDetail; slug: string; episode: string }) {
  const [override, setOverride] = useState<{ episode: string; result: EpisodeResult }>();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const playback = override?.episode === episode ? override.result : result;
  const episodes = useMemo(() => playback.episodes?.filter((item): item is typeof item & { id: string } => Boolean(item.id)) || [], [playback.episodes]);
  const playable = episodes.filter(item => item.available !== false && (!item.time || Date.parse(item.time) <= Date.now()));
  const selectedEpisode = playback.current_episode || episode;
  const current = episodes.find(item => item.id === selectedEpisode);
  const title = drama?.title || result.category?.title || "Drama";
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
    <header className="watch-heading"><Link href={`/${slug}`} className="text-sm text-secondary hover:text-primary inline-flex items-center gap-2"><span aria-hidden="true">←</span>{title}</Link><h1 className="heading text-xl sm:text-2xl font-semibold">{formatEpisodeLabel(episode)}{current?.title && <span className="font-normal text-secondary"> · {current.title}</span>}</h1></header>
    <div className="watch-layout"><div className="watch-primary">
      <EpisodePlayer key={`${slug}/${episode}/${playback.video}`} video={playback.video} servers={playback.servers} title={playback.title} />
      {!playback.video && <div className="flex items-center gap-3 py-3"><button type="button" className="glass-btn text-sm" onClick={retryEpisode} disabled={retrying}>{retrying ? "Reloading…" : "Retry episode"}</button>{retryError && <p role="status" className="text-xs text-secondary">{retryError}</p>}</div>}
      <div className="watch-toolbar"><span className="text-xs text-secondary">{formatEpisodeLabel(selectedEpisode)}</span><VideoControls episodes={playable} currentEpisode={selectedEpisode} slug={slug} /></div>
      {current?.description && <section className="watch-summary"><h2 className="heading text-sm font-semibold mb-2">About this episode</h2><p className="text-sm text-secondary leading-relaxed">{current.description}</p></section>}
      <EpisodeProgressTracker slug={slug} episode={selectedEpisode} title={title} image={drama?.image} totalEpisodes={playable.length} />
    </div><EpisodeList episodes={episodes} currentEpisode={selectedEpisode} slug={slug} poster={drama?.image} /></div>
  </div>;
}
