"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { EpisodeListItem } from "@/lib/api-types";
import { Artwork } from "./Artwork";

type Episode = EpisodeListItem & { id: string };
const identity = (episode: Episode) => {
  const match = /^(?:s(\d+)e)?(\d+(?:\.\d+)?)$/i.exec(episode.id);
  return { season: episode.season || Number(match?.[1]) || 1, number: episode.episode || Number(match?.[2]) || 1 };
};
const pageSize = 50;

export function EpisodeList({ episodes, currentEpisode, slug, poster }: { episodes: Episode[]; currentEpisode: string; slug: string; poster?: string }) {
  const active = episodes.find(episode => episode.id === currentEpisode);
  const activeSeason = active ? identity(active).season : 1;
  const [query, setQuery] = useState("");
  const [season, setSeason] = useState(activeSeason);
  const [descending, setDescending] = useState(false);
  const [grid, setGrid] = useState(false);
  const [page, setPage] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const seasons = [...new Set(episodes.map(episode => identity(episode).season))].sort((a, b) => a - b);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const numeric = /^#?(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(search);
    return episodes.filter(episode => {
      const value = identity(episode);
      if (value.season !== season) return false;
      return !search || (numeric ? value.number >= Number(numeric[1]) && value.number <= Number(numeric[2] || numeric[1]) : `${episode.title || ""} ${episode.id}`.toLowerCase().includes(search));
    }).sort((a, b) => (identity(a).number - identity(b).number) * (descending ? -1 : 1));
  }, [episodes, season, query, descending]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  useEffect(() => {
    setSeason(activeSeason);
    const inSeason = episodes.filter(episode => identity(episode).season === activeSeason).sort((a,b) => identity(a).number - identity(b).number);
    setPage(Math.max(0, Math.floor(inSeason.findIndex(episode => episode.id === currentEpisode) / pageSize)));
    setQuery("");
    setDescending(false);
  }, [currentEpisode, activeSeason, episodes]);
  useEffect(() => { list.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: "nearest" }); }, [currentEpisode, currentPage, grid]);

  return <aside className="episode-panel" aria-label="Episode browser">
    <div className="episode-panel-heading"><h2 className="heading">Episodes <span className="text-secondary text-xs font-normal">{episodes.length}</span></h2><div className="flex gap-1">
      <button type="button" className="episode-icon-button" onClick={() => { setDescending(value => !value); setPage(0); }} aria-label={descending ? "Sort episodes ascending" : "Sort episodes descending"} title={descending ? "Oldest first" : "Newest first"}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={descending ? "M12 4v16m-7-7 7 7 7-7" : "M12 20V4m-7 7 7-7 7 7"}/></svg></button>
      <button type="button" className="episode-icon-button" onClick={() => setGrid(value => !value)} aria-label={grid ? "Show episode list" : "Show episode grid"} aria-pressed={grid}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">{grid ? <path d="M4 6h16M4 12h16M4 18h16"/> : <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>}</svg></button>
    </div></div>
    <label className="episode-find"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input type="search" aria-label="Find episode" placeholder="Find number or title…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} onKeyDown={event => { if (event.key === "Escape") setQuery(""); }} /></label>
    {(seasons.length > 1 || pages > 1) && <div className="flex gap-2">
      {seasons.length > 1 && <select className="episode-select" aria-label="Season" value={season} onChange={event => { setSeason(Number(event.target.value)); setPage(0); setQuery(""); }}>{seasons.map(number => <option key={number} value={number}>Season {number}</option>)}</select>}
      {pages > 1 && <select className="episode-select" aria-label="Episode range" value={currentPage} onChange={event => setPage(Number(event.target.value))}>{Array.from({ length: pages }, (_, index) => <option key={index} value={index}>{identity(filtered[index * pageSize]).number}–{identity(filtered[Math.min((index + 1) * pageSize - 1, filtered.length - 1)]).number}</option>)}</select>}
    </div>}
    <div ref={list} className={`episode-scroll ${grid ? "episode-grid" : ""}`} aria-label="Episodes">
      {visible.map(episode => {
        const { number } = identity(episode);
        const current = episode.id === currentEpisode;
        const upcoming = Boolean(episode.time && Date.parse(episode.time) > Date.now());
        const disabled = episode.available === false || upcoming;
        const title = episode.title || `Episode ${number}`;
        const content = <><div className="episode-thumbnail"><Artwork sources={[episode.image, poster]} alt="" />{current && <span className="episode-playing" aria-hidden="true"><i/><i/><i/></span>}</div><div className="episode-copy"><p className="episode-name"><span>{number}.</span> {title}</p>{episode.description && <p className="episode-description">{episode.description}</p>}{current ? <p className="episode-state">Now playing</p> : disabled ? <p className="episode-state text-secondary">{upcoming ? "Upcoming" : "Unavailable"}</p> : episode.time && <time className="episode-date" dateTime={episode.time}>{new Date(episode.time).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" })}</time>}</div></>;
        return disabled ? <article className="watch-episode is-unavailable" key={episode.id} aria-label={`Episode ${number}: ${title}`}>{content}</article> : <Link key={episode.id} href={`/${slug}/episode/${episode.id}`} prefetch={false} aria-current={current ? "page" : undefined} aria-label={`Episode ${number}: ${title}`} className={`watch-episode ${current ? "is-current" : ""}`}>{content}</Link>;
      })}
      {!visible.length && <p className="source-empty py-8" role="status">{episodes.length ? "No episodes match your search." : "No episodes are listed yet."}</p>}
    </div>
    {query && <p className="text-xs text-secondary" role="status">{filtered.length} matching {filtered.length === 1 ? "episode" : "episodes"}</p>}
  </aside>;
}
