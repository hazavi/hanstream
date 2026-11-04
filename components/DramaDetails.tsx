"use client";

import { useState } from "react";
import { Artwork } from "./Artwork";
import Link from "next/link";
import type { DramaDetail, DramaEpisode, DramaTrailer } from "@/lib/api-types";
import { Breadcrumb } from "./Breadcrumb";
import { DescriptionSection } from "./DescriptionSection";
import { WatchlistButton } from "./WatchlistButton";
import { DramaRatingButton } from "./DramaRatingButton";


function Trailer({ trailer }: { trailer: DramaTrailer }) {
  const [playing, setPlaying] = useState(false);
  // Only the supported privacy-enhanced video embed may reach an iframe.
  const valid = /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}$/.test(trailer.embedUrl);
  if (!valid) return null;
  return <section aria-labelledby="trailer-heading" className="space-y-4">
    <h2 id="trailer-heading" className="text-xl sm:text-2xl heading font-bold">Trailer</h2>
    <div className="relative aspect-video overflow-hidden rounded-2xl glass-card">
      {playing ? <iframe title={trailer.title || "Official trailer"} src={`${trailer.embedUrl}?autoplay=1&rel=0`} className="absolute inset-0 w-full h-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <button type="button" className="absolute inset-0 w-full h-full group cursor-pointer" onClick={() => setPlaying(true)} aria-label="Play official trailer">
        <Artwork sources={[trailer.thumbnail]} alt={trailer.title || "Official trailer"} />
        <span className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
        <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-white/95 text-black p-5 shadow-lg group-hover:scale-105 transition-transform"><svg aria-hidden="true" className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span></span>
        <span className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-left text-white text-sm sm:text-base font-medium bg-gradient-to-t from-black/80 to-transparent">{trailer.title || "Official trailer"}</span>
      </button>}
    </div>
  </section>;
}

function airDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return undefined;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" });
}

function EpisodeCard({ episode, posters }: { episode: DramaEpisode; posters: (string | undefined)[] }) {
  const future = Boolean(episode.release_date && Date.parse(episode.release_date) > Date.now());
  const available = episode.available !== false && !future;
  const label = `Episode ${episode.episode}`;
  const content = <>
    <div className="relative aspect-video overflow-hidden surface">
      <Artwork sources={[episode.image, ...posters]} alt={episode.title || label} />
      <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <span className="absolute bottom-2 left-3 text-white text-xs font-semibold">S{String(episode.season || 1).padStart(2, "0")} E{String(episode.episode).padStart(2, "0")}</span>
      {episode.finale && <span className="absolute top-2 left-2 rounded-md bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white">Finale</span>}
      {available && <span aria-hidden="true" className="absolute right-3 bottom-2 text-white"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>}
    </div>
    <div className="p-3 sm:p-4 space-y-2">
      <p className="text-sm font-semibold text-primary line-clamp-2">{episode.title || label}</p>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary"><span>{label}</span>{episode.release_date && <time dateTime={episode.release_date}>{airDate(episode.release_date)}</time>}</div>
      {!available && <p className="text-xs text-secondary">{future ? "Upcoming" : "Playback unavailable"}</p>}
    </div>
  </>;
  const classes = `block overflow-hidden glass-card rounded-xl ${available ? "card-hover group" : ""}`;
  const accessibleName = `${(episode.season || 1) > 1 ? `Season ${episode.season}, ` : ""}${label}${episode.title ? `: ${episode.title}` : ""}`;
  return available ? <Link href={episode.episode_link} aria-label={accessibleName} className={classes} prefetch={false}>{content}</Link> : <article aria-label={accessibleName} className={classes}>{content}</article>;
}

export function DramaDetails({ detail, slug }: { detail: DramaDetail; slug: string }) {
  const title = detail.title || "Drama";
  const posters = [detail.image, ...(detail.poster_fallbacks || [])];
  const genres = detail.genres?.length ? detail.genres : String(detail.meta?.Genre || "").split(/[,;]/).map(value => value.trim()).filter(Boolean);
  const facts = Object.entries(detail.meta || {}).filter(([key, value]) => !["genre", "original title", "rating votes"].includes(key.toLowerCase()) && ["string", "number"].includes(typeof value) && String(value).trim() && !/^https?:\/\//i.test(String(value)));
  const seasons = [...new Set((detail.episodes || []).map(episode => episode.season || Number(/\/s(\d+)e/.exec(episode.episode_link)?.[1]) || 1))].sort((a, b) => a - b);
  return <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10 animate-fade-in">
    <Breadcrumb items={[{ label: "Home", href: "/" }, { label: title, isActive: true }]} />
    <header className="grid grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
      <div className="relative aspect-[2/3] w-full max-w-[280px] mx-auto sm:mx-0 rounded-2xl overflow-hidden glass-card shadow-lg">
        <Artwork key={posters.join("|")} sources={posters} alt={`${title} poster`} poster />
        <WatchlistButton slug={slug} title={title} image={detail.image} /><DramaRatingButton slug={slug} title={title} image={detail.image} />
      </div>
      <div className="min-w-0 space-y-5">
        <div className="space-y-2"><h1 className="text-3xl lg:text-4xl font-bold heading leading-tight">{title}</h1>{detail.other_names && <p className="text-sm text-secondary leading-relaxed">{detail.other_names}</p>}</div>
        {genres.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Genres">{genres.map(genre => <span key={genre} className="surface rounded-full px-3 py-1 text-xs font-medium text-primary">{genre}</span>)}</div>}
        {facts.length > 0 && <dl className="glass-card rounded-xl p-4 sm:p-5 grid grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4">{facts.map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-xs text-secondary mb-1">{key === "Rating" ? "Community rating" : key.replaceAll("_", " ")}</dt><dd className="text-sm text-primary break-words font-medium">{String(value)}{key === "Rating" && "/10"}{key === "Rating" && Boolean(detail.meta?.["Rating votes"]) && <span className="block text-xs text-secondary font-normal mt-1">{String(detail.meta?.["Rating votes"])} votes</span>}</dd></div>)}</dl>}
        <section aria-labelledby="summary-heading" className="space-y-3"><h2 id="summary-heading" className="text-lg font-semibold heading">Summary</h2>{detail.description ? <DescriptionSection description={detail.description} /> : <p className="text-sm text-secondary">A summary is not available yet.</p>}</section>
        {detail.detailsUnavailable && <p className="text-xs text-secondary">Some drama details are temporarily unavailable.</p>}
      </div>
    </header>
    {Boolean(detail.tags?.length) && <section aria-labelledby="tags-heading" className="glass-card rounded-2xl p-4 sm:p-5 space-y-3"><h2 id="tags-heading" className="text-lg font-semibold heading">Tags</h2><ul className="flex flex-wrap gap-2">{detail.tags?.map(tag => <li key={tag} className="surface text-secondary rounded-lg px-3 py-1.5 text-xs">{tag}</li>)}</ul></section>}
    {detail.trailer && <Trailer key={detail.trailer.embedUrl} trailer={detail.trailer} />}
    <section aria-labelledby="episodes-heading" className="space-y-6"><h2 id="episodes-heading" className="text-xl sm:text-2xl font-bold heading">Episodes ({detail.episodes?.length || 0})</h2>
      {seasons.map(season => <section key={season} aria-label={`Season ${season}`} className="space-y-4"><h3 className="heading text-lg font-semibold">Season {season}</h3><div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">{detail.episodes?.filter(ep => (ep.season || Number(/\/s(\d+)e/.exec(ep.episode_link)?.[1]) || 1) === season).map(ep => <EpisodeCard key={ep.episode_link} episode={{ ...ep, season }} posters={posters} />)}</div></section>)}
      {!detail.episodes?.length && <p className="source-empty">No episodes are listed yet.</p>}
    </section>
  </div>;
}
