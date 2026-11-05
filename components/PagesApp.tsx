"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { peekBackend, readBackend, subscribeBackend } from "@/lib/pages-client";
import type { DramaResponse, EpisodeResult, PopularItem, RecentItem, SearchResponse, TopDramasResponse } from "@/lib/api-types";
import { ContinueWatching } from "./ContinueWatching";
import { DramaCard } from "./DramaCard";
import { TopAiringSection } from "./TopAiringSection";
import { HomepageHighlights, type HomepageHighlightsData } from "./HomepageHighlights";
import { PageSkeleton } from './PageSkeleton';
import { ConnectionStatus } from './ConnectionStatus';
const DramaDetails = dynamic(() => import('./DramaDetails').then(module => module.DramaDetails), { loading: () => <PageSkeleton view="drama" /> });
const WatchPage = dynamic(() => import('./WatchPage').then(module => module.WatchPage), { loading: () => <PageSkeleton view="watch" /> });

type HomeData = { home: HomepageHighlightsData; recent: RecentItem[]; popular: PopularItem[]; rankings: TopDramasResponse["result"]; partial?: boolean };
type CatalogData = { items: (RecentItem | PopularItem)[]; page: number; hasNext: boolean };
type WatchData = { result: EpisodeResult; drama: DramaResponse["result"] };
type View = "home" | "popular" | "recently-added" | "recent-movies" | "search" | "drama" | "watch";

function Cards({ items }: { items: (RecentItem | PopularItem)[] }) {
  return items.length ? <div className="homepage-grid">{items.map(item => "episode-link" in item ? <DramaCard key={item["episode-link"]} item={item} variant="recent" /> : <DramaCard key={item["detail-link"]} item={item} variant="popular" />)}</div> : <p className="source-empty">No dramas are listed right now.</p>;
}
function Home({ data }: { data: HomeData }) {
  return <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 w-full items-start">
    <div className="flex-1 min-w-0 space-y-8 sm:space-y-12 animate-fade-in">
      <ContinueWatching />
      {data.partial && <p role="status" className="text-sm text-secondary">Some listings are temporarily unavailable.</p>}
      {([{ title: "Latest Episodes", href: "/recently-added", items: data.recent }, { title: "Popular Dramas", href: "/popular", items: data.popular }]).map(section => <section key={section.href} className="space-y-4 sm:space-y-6"><div className="flex items-center justify-between"><h2 className="text-xl sm:text-2xl font-bold heading">{section.title}</h2><Link href={section.href} className="glass-btn text-sm">View all</Link></div><Cards items={section.items} /></section>)}
    </div><div className="w-full lg:w-80 xl:w-96 shrink-0 space-y-5"><TopAiringSection result={data.rankings} /><HomepageHighlights home={data.home} /></div>
  </div>;
}
export default function PagesApp({ view }: { view: View }) {
  const query = useSearchParams();
  const slug = query.get("id") || "";
  const episode = query.get("episode") || "";
  const search = query.get("q") || "";
  const page = Math.max(1, Math.floor(Number(query.get("page")) || 1));
  const kind = view === "popular" ? "popular" : view === "recent-movies" ? "movies" : "recent";
  const route = view === "home" ? "/api/home" : view === "drama" ? `/api/drama/${encodeURIComponent(slug)}` : view === "watch" ? `/api/episode/${encodeURIComponent(slug)}/${encodeURIComponent(episode)}` : view === "search" ? `/api/search?q=${encodeURIComponent(search)}&page=${page}` : `/api/catalog?kind=${kind}&page=${page}`;
  const [state, setState] = useState<{ route: string; data?: unknown; error?: string }>(()=>({ route, data:peekBackend(route) }));
  const [retry, setRetry] = useState(0);
  const homeRetries = useRef(0);
  useEffect(() => {
    if (view !== 'home' || state.route !== route || !(state.data as HomeData | undefined)?.partial || homeRetries.current >= 5) return;
    const timer = setTimeout(() => { homeRetries.current++; setRetry(value => value+1); },[2000,5000,10000,20000,30000][homeRetries.current]);
    return () => clearTimeout(timer);
  },[view,route,state]);
  useEffect(() => {
    if ((view === "drama" || view === "watch") && !slug || view === "watch" && !episode || view === "search" && !search) return;
    const controller = new AbortController();
    setState({ route, data:peekBackend(route) });
    const unsubscribe=subscribeBackend(route,()=>{const data=peekBackend(route);if(data&&!controller.signal.aborted)setState({route,data});});
    readBackend(route, controller.signal,{fresh:retry>0}).then(data => {
      if (controller.signal.aborted) return;
      setState({ route, data });
    }).catch(error => { if (!controller.signal.aborted) setState(current => current.route===route && current.data ? current : { route, error: error.message }); });
    return () => {unsubscribe();controller.abort();};
  }, [route, retry, view, slug, episode, search]);
  if ((view === "drama" || view === "watch") && !slug || view === "watch" && !episode) return <p className="glass-card p-6">Choose a drama from <Link href="/" className="underline">the homepage</Link>.</p>;
  if (view === "search" && !search) return <p className="glass-card p-6">Enter a drama title in the search bar.</p>;
  if (state.route !== route || !state.data && !state.error) return <><ConnectionStatus/><PageSkeleton view={view} /></>;
  if (state.error) return <div role="alert" className="glass-card p-6 space-y-4"><p>{state.error}</p><button className="glass-btn" onClick={() => setRetry(value => value + 1)}>Try again</button></div>;
  if (view === "home") return <Home data={state.data as HomeData} />;
  if (view === "drama") { const detail = (state.data as DramaResponse).result; return detail ? <DramaDetails detail={detail} slug={slug} /> : <p className="source-empty">Drama details are unavailable.</p>; }
  if (view === "watch") { const data = state.data as WatchData; return <WatchPage result={data.result} drama={data.drama} slug={slug} episode={episode} />; }
  const items = view === "search" ? (state.data as SearchResponse).results : (state.data as CatalogData).items;
  const hasNext = view === "search" ? items.length >= 20 : (state.data as CatalogData).hasNext;
  const pageLink = (target: number) => `/${view}/?${new URLSearchParams({ ...(view === "search" ? { q: search } : {}), page: String(target) })}`;
  return <div className="space-y-6"><h1 className="heading text-3xl">{view === "search" ? `Search: ${search}` : view === "popular" ? "Popular Dramas" : view === "recent-movies" ? "Recent Movies" : "Latest Episodes"}</h1><Cards items={items} /><nav aria-label="Pagination" className="flex justify-center items-center gap-4">{page > 1 && <Link className="glass-btn" href={pageLink(page - 1)}>Previous</Link>}<span className="text-sm text-secondary">Page {page}</span>{hasNext && <Link className="glass-btn" href={pageLink(page + 1)}>Next</Link>}</nav></div>;
}
