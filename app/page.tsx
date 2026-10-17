import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ContinueWatching } from "@/components/ContinueWatching";
import { DramaCard } from "@/components/DramaCard";
import { TopAiringSection } from "@/components/TopAiringSection";
import { HeroSection } from "@/components/HeroSection";
import { catalogRoute, type CatalogTitle } from "@/lib/catalog";
import { fetchPopular, fetchPopularSeries, fetchRecent } from "@/lib/api";
import { getHomepage, HOME_LABELS, type HomeSection } from "@/lib/metadata";

// Render week boundaries and cached public-page metadata on request.
export const dynamic = "force-dynamic";

function GridSkeleton() {
  return <div className="homepage-grid" aria-label="Loading dramas">{Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-[4/5] rounded-2xl surface animate-pulse" />)}</div>;
}

async function LatestEpisodes() {
  try {
    const data = await fetchRecent();
    return data.results.length ? <div className="homepage-grid">{data.results.slice(0, 12).map(item => <DramaCard key={item["episode-link"]} item={item} variant="recent" />)}</div> : <p className="source-empty">No episodes are listed right now.</p>;
  } catch { return <p className="source-empty">Latest episodes are temporarily unavailable.</p>; }
}

async function PopularPreview() {
  try {
    const data = await fetchPopular();
    return data.results.length ? <div className="homepage-grid">{data.results.slice(0, 12).map(item => <DramaCard key={item["detail-link"]} item={item} variant="popular" />)}</div> : <p className="source-empty">No popular dramas are listed right now.</p>;
  } catch { return <p className="source-empty">Popular dramas are temporarily unavailable.</p>; }
}

function HomepageGrid({ section, items }: { section: HomeSection; items: CatalogTitle[] }) {
  try {
    if (!items.length) return <p className="source-empty">No published entries are listed for this week.</p>;
    return <div className="homepage-grid">{items.map(item => <article key={`${catalogRoute(item)}-${item.date || section}`} className="glass-card rounded-xl sm:rounded-2xl overflow-hidden card-hover animate-slide-up">
      <Link href={catalogRoute(item)} className="block group">
        <div className="aspect-[4/5] relative surface overflow-hidden"><Image src={item.image} alt={item.title} fill sizes="(max-width:640px) 44vw, (max-width:1024px) 23vw, 15vw" className="object-cover group-hover:scale-105 transition-transform duration-500" /></div>
        <div className="p-2 sm:p-3 md:p-4 space-y-1"><h3 className="text-xs sm:text-sm font-semibold text-primary line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">{item.title}</h3>
          {section !== "reviews" && (item.note || item.year) && <p className="text-xs text-secondary line-clamp-2">{item.note || item.year}</p>}
        </div>
      </Link>
      {section === "reviews" && <div className="px-3 pb-3 space-y-2">
        {item.date && <p className="text-xs text-secondary">{new Date(item.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Copenhagen" })}</p>}
        {item.note && <p className="text-xs text-secondary">{item.note}</p>}
      </div>}
    </article>)}</div>;
  } catch { return <p className="source-empty">Drama listings are temporarily unavailable.</p>; }
}

export default async function Home() {
  const [homepage, rankings] = await Promise.all([getHomepage(), fetchPopularSeries()]);
  const sections = ["reviews", "trending", "starting", "ending"] as const;
  return <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 w-full items-start">
    <div className="flex-1 animate-fade-in min-w-0 space-y-8 sm:space-y-12">
      <HeroSection />
      <Suspense fallback={null}><ContinueWatching /></Suspense>
      <section id="recent" className="space-y-4 sm:space-y-6 scroll-mt-24">
        <div className="flex items-center justify-between"><h2 className="text-xl sm:text-2xl font-bold heading">Latest Episodes</h2><Link href="/recently-added" className="glass-btn group !px-3 sm:!px-4 !py-2 text-sm sm:text-base">View all <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">›</span></Link></div>
        <Suspense fallback={<GridSkeleton />}><LatestEpisodes /></Suspense>
      </section>
      <section id="popular" className="space-y-4 sm:space-y-6 scroll-mt-24">
        <div className="flex items-center justify-between"><h2 className="text-xl sm:text-2xl font-bold heading">Popular Dramas</h2><Link href="/popular" className="glass-btn group !px-3 sm:!px-4 !py-2 text-sm sm:text-base">View all <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">›</span></Link></div>
        <Suspense fallback={<GridSkeleton />}><PopularPreview /></Suspense>
      </section>
      {sections.map(section => <section key={section} id={section} className="space-y-4 sm:space-y-6 scroll-mt-24">
        <div className="flex items-baseline justify-between gap-3"><h2 className="text-xl sm:text-2xl font-bold heading">{HOME_LABELS[section]}</h2></div>
        <HomepageGrid section={section} items={homepage[section]} />
      </section>)}
    </div>
    <div className="w-full lg:w-80 xl:w-96 shrink-0"><TopAiringSection result={rankings.result} /></div>
  </div>;
}
