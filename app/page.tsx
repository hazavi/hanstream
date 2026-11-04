import { Suspense } from "react";
import Link from "next/link";
import { ContinueWatching } from "@/components/ContinueWatching";
import { DramaCard } from "@/components/DramaCard";
import { TopAiringSection } from "@/components/TopAiringSection";
import { HomepageHighlights } from "@/components/HomepageHighlights";
import { fetchPopular, fetchPopularSeries, fetchRecent } from "@/lib/api";
import { getHomepage } from "@/lib/metadata";

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

export default async function Home() {
  const [homepage, rankings] = await Promise.all([getHomepage(), fetchPopularSeries()]);
  return <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 w-full items-start">
    <div className="flex-1 animate-fade-in min-w-0 space-y-8 sm:space-y-12">
      <Suspense fallback={null}><ContinueWatching /></Suspense>
      <section id="recent" className="space-y-4 sm:space-y-6 scroll-mt-24">
        <div className="flex items-center justify-between"><h2 className="text-xl sm:text-2xl font-bold heading">Latest Episodes</h2><Link href="/recently-added" className="glass-btn group !px-3 sm:!px-4 !py-2 text-sm sm:text-base">View all <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">›</span></Link></div>
        <Suspense fallback={<GridSkeleton />}><LatestEpisodes /></Suspense>
      </section>
      <section id="popular" className="space-y-4 sm:space-y-6 scroll-mt-24">
        <div className="flex items-center justify-between"><h2 className="text-xl sm:text-2xl font-bold heading">Popular Dramas</h2><Link href="/popular" className="glass-btn group !px-3 sm:!px-4 !py-2 text-sm sm:text-base">View all <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">›</span></Link></div>
        <Suspense fallback={<GridSkeleton />}><PopularPreview /></Suspense>
      </section>
    </div>
    <div className="w-full lg:w-80 xl:w-96 shrink-0 space-y-5"><TopAiringSection result={rankings.result} /><HomepageHighlights home={homepage} /></div>
  </div>;
}
