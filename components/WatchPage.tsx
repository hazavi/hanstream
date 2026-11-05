"use client";

import { Breadcrumb } from "./Breadcrumb";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RotateCcw } from "lucide-react";
import { readBackend, peekBackend, subscribeBackend } from '@/lib/pages-client';
import type { DramaDetail, DramaResponse, EpisodeResult } from "@/lib/api-types";
import { EpisodePlayer } from "./EpisodePlayer";
import { EpisodeList } from "./EpisodeList";
import { EpisodeProgressTracker } from "./EpisodeProgressTracker";
import { VideoControls } from "./VideoControls";
import { formatEpisodeLabel } from "@/lib/format";

export function WatchPage({ result, drama: initialDrama, slug, episode }: { result: EpisodeResult; drama?: DramaDetail; slug: string; episode: string }) {
  const detailPath = '/api/drama/'+encodeURIComponent(slug);
  const [details,setDetails]=useState<{slug:string;value:DramaDetail|undefined}>(()=>({slug,value:initialDrama || peekBackend<DramaResponse>(detailPath)?.result}));
  const drama=details.slug===slug ? details.value || initialDrama : initialDrama;
  useEffect(()=>{
    const controller=new AbortController();
    const update=()=>{const value=peekBackend<DramaResponse>(detailPath)?.result;if(value&&!controller.signal.aborted)setDetails({slug,value});};
    const unsubscribe=subscribeBackend(detailPath,update);
    void readBackend<DramaResponse>(detailPath,controller.signal,{sameOrigin:true}).then(data=>{if(data.result&&!controller.signal.aborted)setDetails({slug,value:data.result});}).catch(()=>{});
    return ()=>{controller.abort();unsubscribe();};
  },[detailPath,slug]);
  const frameRoot = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState(0);
  const [override, setOverride] = useState<{ episode: string; result: EpisodeResult }>();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const playback = override?.episode === episode ? override.result : result;
  const episodes = useMemo(() => {
    const published=drama?.episodes?.filter(ep=>typeof ep.episode_link==='string').map(ep=>({id:ep.episode_link.split('/').pop(),title:ep.title,time:ep.release_date,season:ep.season,episode:ep.episode,image:ep.image,description:ep.description,available:ep.available}));
    return (published?.length?published:playback.episodes)?.filter((item):item is typeof item & {id:string}=>Boolean(item.id)) || [];
  },[drama?.episodes,playback.episodes]);
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
    <header className="watch-heading"><Breadcrumb items={[{label:"Home",href:"/"},{label:title,href:`/${slug}`},{label:formatEpisodeLabel(selectedEpisode),isActive:true}]}/><h1 className="heading text-xl sm:text-2xl font-semibold">{formatEpisodeLabel(episode)}{current?.title && current.title.toLowerCase()!==formatEpisodeLabel(episode).toLowerCase() && <span className="font-normal text-secondary"> · {current.title}</span>}</h1></header>
    <div className="watch-layout" style={frameHeight ? { "--watch-frame-height": frameHeight + "px" } as CSSProperties : undefined}><div ref={frameRoot} className="watch-primary">
      <EpisodePlayer preferenceKey={slug} key={`${slug}/${episode}/${playback.video}`} video={playback.video} servers={playback.servers} title={playback.title} navigation={<VideoControls episodes={playable} currentEpisode={selectedEpisode} slug={slug}/>} />
      {!playback.video && <div className="flex items-center gap-3 py-3"><button type="button" className="glass-btn text-sm inline-flex items-center gap-2" onClick={retryEpisode} disabled={retrying}><RotateCcw size={14} aria-hidden="true" className={retrying ? "animate-spin" : ""}/>{retrying ? "Reloading…" : "Retry episode"}</button>{retryError && <p role="status" className="text-xs text-secondary">{retryError}</p>}</div>}
      {current?.description && <section className="watch-summary"><h2 className="heading text-sm font-semibold mb-2">About this episode</h2><p className="text-sm text-secondary leading-relaxed">{current.description}</p></section>}
      <EpisodeProgressTracker slug={slug} episode={selectedEpisode} title={title} image={drama?.image} totalEpisodes={playable.length} enabled={Boolean(playback.video)} />
    </div><EpisodeList episodes={episodes} currentEpisode={selectedEpisode} slug={slug} poster={drama?.image} coverTitle={title} coverYear={Number(drama?.meta?.Released) || undefined} /></div>
  </div>;
}
