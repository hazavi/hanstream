"use client";

import { Artwork } from "./Artwork";
import { useEffect, useMemo, useState } from 'react';
import Link from "next/link";
import type { DramaDetail, DramaEpisode, DramaResponse } from "@/lib/api-types";
import { detailNeedsRefresh, englishDramaResponse, mergeDramaResponse } from '@/lib/detail-cache';
import { readBackend } from '@/lib/pages-client';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { DramaMedia } from './DramaMedia';
import { Breadcrumb } from "./Breadcrumb";
import { DescriptionSection } from "./DescriptionSection";
import { WatchlistButton } from "./WatchlistButton";
import { DramaRatingButton } from "./DramaRatingButton";
import { canonicalEpisode, useEpisodeHistory } from '@/lib/profile';
import { pauseRequest, waitForActivePage } from '@/lib/request-retry';
import { NoticeToast } from './ui/toast';


function airDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return undefined;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" });
}

const episodesPerPage = 24;

function EpisodeCard({ episode, posters, watched }: { episode: DramaEpisode; posters: (string | undefined)[]; watched: boolean }) {
  const future = Boolean(episode.release_date && Date.parse(episode.release_date) > Date.now() || episode.available === false && !episode.release_date);
  const available = episode.available !== false && !future;
  const label = `Episode ${episode.episode}`;
  const content = <>
    <div className="relative aspect-video overflow-hidden surface">
      <Artwork sources={future ? [] : [episode.image, ...posters]} alt={episode.title || label} placeholder={future ? "Upcoming" : undefined} fallbackLabel={future ? `E${episode.episode}` : undefined}/>
      <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <span className="absolute bottom-2 left-3 text-white text-xs font-semibold">S{String(episode.season || 1).padStart(2, "0")} E{String(episode.episode).padStart(2, "0")}</span>
      {episode.finale && <span className="absolute top-2 left-2 rounded-md bg-neutral-600 px-2 py-1 text-[10px] font-semibold text-white">Finale</span>}
      {available && <span aria-hidden="true" className="absolute right-3 bottom-2 text-white"><Play size={18} fill="currentColor" aria-hidden="true"/></span>}
    </div>
    <div className="p-3 sm:p-4 space-y-2">
      <p className="text-sm font-semibold text-primary line-clamp-2">{episode.title || label}</p>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary"><span>{label}</span>{episode.release_date && <time dateTime={episode.release_date}>{airDate(episode.release_date)}</time>}</div>
      {!available && !future && <p className="text-xs text-secondary">Playback unavailable</p>}
    </div>
  </>;
  const classes = `block overflow-hidden glass-card rounded-xl ${available ? "card-hover group" : ""} ${watched?'is-watched episode-card-watched':''}`;
  const accessibleName = `${(episode.season || 1) > 1 ? `Season ${episode.season}, ` : ""}${label}${episode.title ? `: ${episode.title}` : ""}`;
  return <article aria-label={available?undefined:accessibleName} className={classes}>{available?<Link href={episode.episode_link} aria-label={accessibleName} prefetch={false}>{content}</Link>:content}</article>;
}

export function DramaDetails({ detail: initialDetail, slug }: { detail: DramaDetail; slug: string }) {
  const [recovered, setRecovered] = useState<{initial:DramaDetail;slug:string;detail:DramaDetail}>();
  const [episodePage, setEpisodePage] = useState({ slug, index: 0 });
  const history = useEpisodeHistory(slug);
  const watched = useMemo(() => new Set(history.watched), [history.watched]);
  const currentDetail = recovered?.slug===slug && recovered.initial===initialDetail ? recovered.detail : initialDetail;
  const detail = useMemo(() => englishDramaResponse({result: currentDetail}).result!, [currentDetail]);
  const episodes = detail.episodes || [];
  const pageCount = Math.max(1, Math.ceil(episodes.length / episodesPerPage));
  const page = Math.min(episodePage.slug === slug ? episodePage.index : 0, pageCount - 1);
  const visibleEpisodes = episodes.slice(page * episodesPerPage, (page + 1) * episodesPerPage);
  useEffect(() => {
    if (!detailNeedsRefresh({result:initialDetail})) return;
    const controller = new AbortController();
    void (async () => {
      let current: DramaResponse = {result: initialDetail};
      for (let attempt = 0; detailNeedsRefresh(current); attempt++) {
        await pauseRequest(Math.min(60_000, 16_000 * 2 ** Math.min(attempt, 2)), controller.signal);
        await waitForActivePage(controller.signal);
        try {
          const data = await readBackend<DramaResponse>(`/api/drama/${encodeURIComponent(slug)}`,controller.signal,{fresh:true,sameOrigin:true});
          if (controller.signal.aborted) return;
          current = mergeDramaResponse(current, data);
          if(current.result) setRecovered({initial:initialDetail,slug,detail:current.result});
        } catch { if (controller.signal.aborted) return; }
      }
    })().catch(()=>{});
    return ()=>controller.abort();
  },[initialDetail,slug]);
  const title = detail.title || "Drama";
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  const recovery = `${base}/api/artwork?${new URLSearchParams({ title, ...(Number(detail.meta?.Released) ? { year: String(detail.meta?.Released) } : {}) })}`;
  const posters = [detail.image, ...(detail.poster_fallbacks || []), recovery];
  const genres = detail.genres?.length ? detail.genres : String(detail.meta?.Genre || "").split(/[,;]/).map(value => value.trim()).filter(Boolean);
  const tags = [...new Set([...genres, ...(detail.tags || [])])];
  const facts = Object.entries(detail.meta || {}).filter(([key, value]) => !["genre", "cast", "original title", "rating votes", "rating", "community rating", "show type"].includes(key.toLowerCase()) && ["string", "number"].includes(typeof value) && String(value).trim() && !/^https?:\/\//i.test(String(value)));
  const cast = detail.cast?.length ? detail.cast : String(detail.meta?.Cast || "").split(",").map(name => ({ name: name.trim(), character: undefined, image: undefined })).filter(person => person.name);
  return <div className="max-w-7xl mx-auto space-y-8 sm:space-y-10 animate-fade-in">
    <Breadcrumb items={[{ label: "Home", href: "/" }, { label: title, isActive: true }]} />
    <div className="detail-layout">
      <div className="detail-poster relative aspect-[2/3] rounded-xl overflow-hidden glass-card">
        <Artwork key={posters.join("|")} sources={posters} alt={title + " poster"} title={title} year={Number(detail.meta?.Released) || undefined} poster />
        <WatchlistButton slug={slug} title={title} image={detail.image} /><DramaRatingButton slug={slug} title={title} image={detail.image} />
      </div>
      <div className="detail-summary min-w-0 space-y-5">
        <header className="space-y-3"><h1 className="text-3xl lg:text-4xl font-bold heading leading-tight">{title}</h1>{detail.other_names && <p className="text-sm text-secondary leading-relaxed">{detail.other_names}</p>}
          {tags.length > 0 && <ul className="flex flex-wrap gap-2" aria-label="Tags">{tags.map(tag => <li key={tag} className="surface rounded-full px-3 py-1 text-xs font-medium text-primary">{tag}</li>)}</ul>}
        </header>
        <section aria-labelledby="summary-heading" className="space-y-3"><h2 id="summary-heading" className="text-lg font-semibold heading">Summary</h2>{detail.description ? <DescriptionSection description={detail.description} /> : <p className="text-sm text-secondary">A summary is not available yet.</p>}</section>
        <NoticeToast enabled={Boolean(detail.detailsUnavailable)} id={`details-delayed-${slug}`} message="Some drama details are temporarily unavailable. We’ll keep checking for updates." />
      </div>

    </div>
    <div className="detail-media-row"><DramaMedia key={slug} cast={cast} trailer={detail.trailer} facts={facts}/></div>
    <section aria-labelledby="episodes-heading" className="space-y-5"><h2 id="episodes-heading" className="text-xl sm:text-2xl font-bold heading">Episodes ({episodes.length})</h2>
      {pageCount > 1 && <nav aria-label="Episode pages" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-secondary" role="status">{page * episodesPerPage + 1}–{Math.min((page + 1) * episodesPerPage, episodes.length)} of {episodes.length}</p>
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" className="episode-icon-button" aria-label="Previous episode page" disabled={page === 0} onClick={() => setEpisodePage({slug, index: page - 1})}><ChevronLeft size={16} aria-hidden="true"/></button>
          <select aria-label="Episode page" className="episode-select" value={page} onChange={event => setEpisodePage({slug, index: Number(event.target.value)})}>{Array.from({length: pageCount}, (_, index) => <option key={index} value={index}>Episodes {index * episodesPerPage + 1}–{Math.min((index + 1) * episodesPerPage, episodes.length)}</option>)}</select>
          <button type="button" className="episode-icon-button" aria-label="Next episode page" disabled={page === pageCount - 1} onClick={() => setEpisodePage({slug, index: page + 1})}><ChevronRight size={16} aria-hidden="true"/></button>
        </div>
      </nav>}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">{visibleEpisodes.map(episode => <EpisodeCard key={episode.episode_link} episode={episode} posters={posters} watched={watched.has(canonicalEpisode(episode.episode_link.split('/').pop() || String(episode.episode)))}/>)}</div>
      {!episodes.length && <p className="source-empty">No episodes are listed yet.</p>}
    </section>
  </div>;
}
