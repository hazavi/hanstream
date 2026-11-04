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
  const future = Boolean(episode.release_date && Date.parse(episode.release_date) > Date.now() || episode.available === false && !episode.release_date);
  const available = episode.available !== false && !future;
  const label = `Episode ${episode.episode}`;
  const content = <>
    <div className="relative aspect-video overflow-hidden surface">
      <Artwork sources={future ? [] : [episode.image, ...posters]} alt={episode.title || label} placeholder={future ? "Upcoming" : undefined} />
      <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <span className="absolute bottom-2 left-3 text-white text-xs font-semibold">S{String(episode.season || 1).padStart(2, "0")} E{String(episode.episode).padStart(2, "0")}</span>
      {episode.finale && <span className="absolute top-2 left-2 rounded-md bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white">Finale</span>}
      {available && <span aria-hidden="true" className="absolute right-3 bottom-2 text-white"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>}
    </div>
    <div className="p-3 sm:p-4 space-y-2">
      <p className="text-sm font-semibold text-primary line-clamp-2">{episode.title || label}</p>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary"><span>{label}</span>{episode.release_date && <time dateTime={episode.release_date}>{airDate(episode.release_date)}</time>}</div>
      {!available && !future && <p className="text-xs text-secondary">Playback unavailable</p>}
    </div>
  </>;
  const classes = `block overflow-hidden glass-card rounded-xl ${available ? "card-hover group" : ""}`;
  const accessibleName = `${(episode.season || 1) > 1 ? `Season ${episode.season}, ` : ""}${label}${episode.title ? `: ${episode.title}` : ""}`;
  return available ? <Link href={episode.episode_link} aria-label={accessibleName} className={classes} prefetch={false}>{content}</Link> : <article aria-label={accessibleName} className={classes}>{content}</article>;
}

export function DramaDetails({ detail, slug }: { detail: DramaDetail; slug: string }) {
  const title = detail.title || "Drama";
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  const recovery = `${base}/api/artwork?${new URLSearchParams({ title, ...(Number(detail.meta?.Released) ? { year: String(detail.meta?.Released) } : {}) })}`;
  const posters = [detail.image, ...(detail.poster_fallbacks || []), recovery];
  const genres = detail.genres?.length ? detail.genres : String(detail.meta?.Genre || "").split(/[,;]/).map(value => value.trim()).filter(Boolean);
  const tags = [...new Set([...genres, ...(detail.tags || [])])];
  const facts = Object.entries(detail.meta || {}).filter(([key, value]) => !["genre", "cast", "original title", "rating votes"].includes(key.toLowerCase()) && ["string", "number"].includes(typeof value) && String(value).trim() && !/^https?:\/\//i.test(String(value)));
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
        {cast.length > 0 && <section aria-labelledby="cast-heading" className="space-y-4"><h2 id="cast-heading" className="heading text-lg font-semibold">Cast</h2><div className="grid grid-cols-2 gap-3">{cast.map(person => <article key={person.name + person.character} className="flex gap-3 items-center min-w-0"><div className="relative w-12 aspect-[2/3] shrink-0 rounded-md overflow-hidden surface"><Artwork sources={[person.image]} alt={person.name} /></div><div className="min-w-0"><h3 className="text-sm font-medium text-primary">{person.name}</h3>{person.character && <p className="text-xs text-secondary mt-1">{person.character}</p>}</div></article>)}</div></section>}
        {detail.detailsUnavailable && <p className="text-xs text-secondary">Some drama details are temporarily unavailable.</p>}
      </div>
      {facts.length > 0 && <aside className="detail-info glass-card rounded-xl p-5 space-y-4" aria-labelledby="show-info-heading"><h2 id="show-info-heading" className="heading text-lg font-semibold">Show info</h2><dl className="space-y-4">{facts.map(([key, value]) => <div key={key}><dt className="text-xs text-secondary mb-1">{key === "Rating" ? "Community rating" : key.replaceAll("_", " ")}</dt><dd className="text-sm text-primary break-words font-medium">{String(value)}{key === "Rating" && "/10"}{key === "Rating" && Boolean(detail.meta?.["Rating votes"]) && <span className="block text-xs text-secondary font-normal mt-1">{String(detail.meta?.["Rating votes"])} votes</span>}</dd></div>)}</dl></aside>}
    </div>
    {detail.trailer && <Trailer key={detail.trailer.embedUrl} trailer={detail.trailer} />}
    <section aria-labelledby="episodes-heading" className="space-y-5"><h2 id="episodes-heading" className="text-xl sm:text-2xl font-bold heading">Episodes ({detail.episodes?.length || 0})</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">{detail.episodes?.map(episode => <EpisodeCard key={episode.episode_link} episode={episode} posters={posters} />)}</div>
      {!detail.episodes?.length && <p className="source-empty">No episodes are listed yet.</p>}
    </section>
  </div>;
}
