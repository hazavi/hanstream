"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { readBackend } from "@/lib/pages-client";
import { catalogRoute, type CatalogTitle } from "@/lib/catalog";
import type { DramaResponse, EpisodeResult, HotSeriesUpdateItem, PopularItem, RecentItem, ScheduleResponse, SearchResponse, TopDramasResponse } from "@/lib/api-types";
import { HeroCarousel } from "./HeroCarousel";
import { ContinueWatching } from "./ContinueWatching";
import { DramaCard } from "./DramaCard";
import { TopAiringSection } from "./TopAiringSection";
import { WatchlistButton } from "./WatchlistButton";
import { DramaRatingButton } from "./DramaRatingButton";
import { DescriptionSection } from "./DescriptionSection";
import { EpisodePlayer } from "./EpisodePlayer";
import { EpisodeProgressTracker } from "./EpisodeProgressTracker";
import { VideoControls } from "./VideoControls";
import { DayCard } from "./DayCard";

type Section = "reviews" | "trending" | "starting" | "ending";
type HomeData = { home: Record<Section, CatalogTitle[]>; recent: RecentItem[]; popular: PopularItem[]; rankings: TopDramasResponse["result"]; hero: HotSeriesUpdateItem[] };
type CatalogData = { items: (RecentItem | PopularItem)[]; page: number; hasNext: boolean };
type WatchData = { result: EpisodeResult; drama: DramaResponse["result"] };
type View = "home" | "popular" | "recently-added" | "recent-movies" | "search" | "schedule" | "drama" | "watch";
const labels: Record<Section, string> = { reviews: "Latest Reviews", trending: "Trending This Week", starting: "Shows Starting This Week", ending: "Shows Ending This Week" };

function Cards({ items }: { items: (RecentItem | PopularItem)[] }) {
  return items.length ? <div className="homepage-grid">{items.map(item => "episode-link" in item ? <DramaCard key={item["episode-link"]} item={item} variant="recent" /> : <DramaCard key={item["detail-link"]} item={item} variant="popular" />)}</div> : <p className="source-empty">No dramas are listed right now.</p>;
}
function Home({ data }: { data: HomeData }) {
  return <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 w-full items-start">
    <div className="flex-1 min-w-0 space-y-8 sm:space-y-12 animate-fade-in">
      {data.hero.length > 0 && <HeroCarousel items={data.hero} />}<ContinueWatching />
      {([{ title: "Latest Episodes", href: "/recently-added", items: data.recent }, { title: "Popular Dramas", href: "/popular", items: data.popular }]).map(section => <section key={section.href} className="space-y-4 sm:space-y-6"><div className="flex items-center justify-between"><h2 className="text-xl sm:text-2xl font-bold heading">{section.title}</h2><Link href={section.href} className="glass-btn text-sm">View all</Link></div><Cards items={section.items} /></section>)}
      {(Object.keys(labels) as Section[]).map(section => <section key={section} className="space-y-4 sm:space-y-6"><h2 className="text-xl sm:text-2xl font-bold heading">{labels[section]}</h2>
        {data.home[section].length ? <div className="homepage-grid">{data.home[section].map(item => <article key={`${catalogRoute(item)}-${item.date}`} className="glass-card rounded-xl sm:rounded-2xl overflow-hidden card-hover"><Link href={catalogRoute(item)} className="block group"><div className="aspect-[4/5] relative surface overflow-hidden"><Image src={item.image} alt={item.title} fill sizes="(max-width:640px) 44vw, (max-width:1024px) 23vw, 15vw" className="object-cover group-hover:scale-105 transition-transform duration-500" /></div><div className="p-3 space-y-1"><h3 className="text-sm font-semibold text-primary line-clamp-2">{item.title}</h3>{item.note && <p className="text-xs text-secondary line-clamp-2">{item.note}</p>}{section === "reviews" && item.date && <p className="text-xs text-secondary">{new Date(item.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Copenhagen" })}</p>}</div></Link></article>)}</div> : <p className="source-empty">No published entries are listed for this week.</p>}
      </section>)}
    </div><div className="w-full lg:w-80 xl:w-96 shrink-0"><TopAiringSection result={data.rankings} /></div>
  </div>;
}
function Detail({ detail, slug }: { detail: NonNullable<DramaResponse["result"]>; slug: string }) {
  return <div className="space-y-8 animate-fade-in"><h1 className="text-3xl sm:text-4xl heading">{detail.title}</h1><div className="flex flex-col md:flex-row gap-6"><div className="w-full md:w-60 shrink-0 space-y-4">{detail.image && <Image src={detail.image} alt={detail.title || "Drama poster"} width={300} height={400} className="w-full rounded-2xl aspect-[3/4] object-cover" />}<WatchlistButton slug={slug} title={detail.title || "Drama"} image={detail.image} /><DramaRatingButton slug={slug} title={detail.title || "Drama"} image={detail.image} /></div><div className="flex-1 space-y-4">{detail.other_names && <p className="glass-card p-4 text-sm text-secondary">{detail.other_names}</p>}{detail.meta && <dl className="glass-card p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">{Object.entries(detail.meta).map(([key, value]) => <div key={key}><dt className="text-xs text-secondary capitalize">{key.replaceAll("_", " ")}</dt><dd className="text-sm">{String(value)}</dd></div>)}</dl>}{detail.description && <DescriptionSection description={detail.description} />}</div></div><section className="space-y-4"><h2 className="text-2xl heading">Episodes ({detail.episodes?.length || 0})</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{detail.episodes?.map(ep => <Link key={ep.episode_link} href={ep.episode_link} className="surface rounded-xl p-4 hover:surface-hover">Episode {ep.episode}</Link>)}</div>{!detail.episodes?.length && <p className="source-empty">No episodes are available yet.</p>}</section></div>;
}
function Watch({ data, slug, episode }: { data: WatchData; slug: string; episode: string }) {
  const episodes = data.result.episodes?.filter((ep): ep is typeof ep & { id: string } => Boolean(ep.id)) || [];
  return <div className="space-y-5"><Link href={`/${slug}`} className="text-sm text-secondary">Back to {data.drama?.title || "drama"}</Link><h1 className="text-xl sm:text-2xl heading">{data.result.title}</h1><EpisodePlayer key={`${slug}/${episode}`} video={data.result.video} servers={data.result.servers} title={data.result.title} /><VideoControls episodes={episodes} currentEpisode={episode} slug={slug} /><EpisodeProgressTracker slug={slug} episode={episode} title={data.drama?.title || data.result.title} image={data.drama?.image} totalEpisodes={episodes.length} /><section className="glass-card p-4"><h2 className="heading text-xl mb-4">Episodes</h2><div className="flex flex-wrap gap-2">{episodes.map(ep => <Link key={ep.id} href={`/${slug}/episode/${ep.id}`} aria-current={ep.id === episode ? "page" : undefined} className={`glass-btn text-sm ${ep.id === episode ? "ring-2 ring-blue-500" : ""}`}>{ep.title || ep.id}</Link>)}</div></section></div>;
}
export default function PagesApp({ view }: { view: View }) {
  const query = useSearchParams();
  const slug = query.get("id") || "";
  const episode = query.get("episode") || "";
  const search = query.get("q") || "";
  const page = Math.max(1, Math.floor(Number(query.get("page")) || 1));
  const kind = view === "popular" ? "popular" : view === "recent-movies" ? "movies" : "recent";
  const route = view === "home" ? "/api/home" : view === "drama" ? `/api/drama/${encodeURIComponent(slug)}` : view === "watch" ? `/api/episode/${encodeURIComponent(slug)}/${encodeURIComponent(episode)}` : view === "schedule" ? "/api/schedule" : view === "search" ? `/api/search?q=${encodeURIComponent(search)}&page=${page}` : `/api/catalog?kind=${kind}&page=${page}`;
  const [state, setState] = useState<{ route: string; data?: unknown; error?: string }>({ route: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if ((view === "drama" || view === "watch") && !slug || view === "watch" && !episode || view === "search" && !search) return;
    const controller = new AbortController();
    setState({ route });
    readBackend(route, controller.signal).then(data => { if (!controller.signal.aborted) setState({ route, data }); }).catch(error => { if (!controller.signal.aborted) setState({ route, error: error.message }); });
    return () => controller.abort();
  }, [route, retry, view, slug, episode, search]);
  if ((view === "drama" || view === "watch") && !slug || view === "watch" && !episode) return <p className="glass-card p-6">Choose a drama from <Link href="/" className="underline">the homepage</Link>.</p>;
  if (view === "search" && !search) return <p className="glass-card p-6">Enter a drama title in the search bar.</p>;
  if (state.route !== route || !state.data && !state.error) return <div role="status" className="space-y-4"><p className="text-secondary">Loading dramas...</p><div className="homepage-grid">{Array.from({ length: 6 }, (_, index) => <div key={index} className="aspect-[4/5] surface rounded-2xl animate-pulse" />)}</div></div>;
  if (state.error) return <div role="alert" className="glass-card p-6 space-y-4"><p>{state.error}</p><button className="glass-btn" onClick={() => setRetry(value => value + 1)}>Try again</button></div>;
  if (view === "home") return <Home data={state.data as HomeData} />;
  if (view === "drama") { const detail = (state.data as DramaResponse).result; return detail ? <Detail detail={detail} slug={slug} /> : <p className="source-empty">Drama details are unavailable.</p>; }
  if (view === "watch") return <Watch data={state.data as WatchData} slug={slug} episode={episode} />;
  if (view === "schedule") { const data = state.data as ScheduleResponse; return <div className="space-y-6"><h1 className="heading text-3xl">Weekly Schedule</h1><p className="text-secondary">{data.result.schedule_note}</p><div className="grid md:grid-cols-2 gap-5">{Object.entries(data.result.days).map(([day, schedule]) => <DayCard key={day} day={day} schedule={schedule} />)}</div></div>; }
  const items = view === "search" ? (state.data as SearchResponse).results : (state.data as CatalogData).items;
  const hasNext = view === "search" ? items.length >= 20 : (state.data as CatalogData).hasNext;
  const pageLink = (target: number) => `/${view}/?${new URLSearchParams({ ...(view === "search" ? { q: search } : {}), page: String(target) })}`;
  return <div className="space-y-6"><h1 className="heading text-3xl">{view === "search" ? `Search: ${search}` : view === "popular" ? "Popular Dramas" : view === "recent-movies" ? "Recent Movies" : "Latest Episodes"}</h1><Cards items={items} /><nav aria-label="Pagination" className="flex justify-center items-center gap-4">{page > 1 && <Link className="glass-btn" href={pageLink(page - 1)}>Previous</Link>}<span className="text-sm text-secondary">Page {page}</span>{hasNext && <Link className="glass-btn" href={pageLink(page + 1)}>Next</Link>}</nav></div>;
}
