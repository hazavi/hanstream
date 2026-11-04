"use client";

import { Artwork } from "./Artwork";
import Link from "next/link";
import type { DramaDetail, DramaEpisode } from "@/lib/api-types";
import { Play } from 'lucide-react';
import { DramaMedia } from './DramaMedia';
import { Breadcrumb } from "./Breadcrumb";
import { DescriptionSection } from "./DescriptionSection";
import { WatchlistButton } from "./WatchlistButton";
import { DramaRatingButton } from "./DramaRatingButton";
import { EpisodeWatchedButton } from './EpisodeWatchedButton';
import { canonicalEpisode, useEpisodeHistory } from '@/lib/profile';


function airDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return undefined;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" });
}

function EpisodeCard({ episode, posters,slug }: { episode: DramaEpisode; posters: (string | undefined)[];slug:string }) {
  const id=episode.episode_link.split('/').pop()||String(episode.episode);
  const watched=useEpisodeHistory(slug).watched.includes(canonicalEpisode(id));
  const future = Boolean(episode.release_date && Date.parse(episode.release_date) > Date.now() || episode.available === false && !episode.release_date);
  const available = episode.available !== false && !future;
  const label = `Episode ${episode.episode}`;
  const content = <>
    <div className="relative aspect-video overflow-hidden surface">
      <Artwork sources={future ? [] : [episode.image, ...posters]} alt={episode.title || label} placeholder={future ? "Upcoming" : undefined} fallbackLabel={future ? `E${episode.episode}` : undefined}/>
      <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <span className="absolute bottom-2 left-3 text-white text-xs font-semibold">S{String(episode.season || 1).padStart(2, "0")} E{String(episode.episode).padStart(2, "0")}</span>
      {episode.finale && <span className="absolute top-2 left-2 rounded-md bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white">Finale</span>}
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
  return <article aria-label={available?undefined:accessibleName} className={classes}>{available?<Link href={episode.episode_link} aria-label={accessibleName} prefetch={false}>{content}</Link>:content}{!future&&<div className="px-3 pb-3"><EpisodeWatchedButton slug={slug} episode={id}/></div>}</article>;
}

export function DramaDetails({ detail, slug }: { detail: DramaDetail; slug: string }) {
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
        {detail.detailsUnavailable && <p className="text-xs text-secondary">Some drama details are temporarily unavailable.</p>}
      </div>

    </div>
    <div className="detail-media-row"><DramaMedia key={slug} cast={cast} trailer={detail.trailer} facts={facts}/></div>
    <section aria-labelledby="episodes-heading" className="space-y-5"><h2 id="episodes-heading" className="text-xl sm:text-2xl font-bold heading">Episodes ({detail.episodes?.length || 0})</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">{detail.episodes?.map(episode => <EpisodeCard key={episode.episode_link} episode={episode} posters={posters} slug={slug}/>)}</div>
      {!detail.episodes?.length && <p className="source-empty">No episodes are listed yet.</p>}
    </section>
  </div>;
}
