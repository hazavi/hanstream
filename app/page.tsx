import {webRuntime} from "@/lib/deployment";
import {ReaderPage} from "@/components/ReaderPage";
import { Suspense } from "react";
import Link from "next/link";
import { ContinueWatching } from "@/components/ContinueWatching";
import { DramaCard } from "@/components/DramaCard";
import { TopAiringSection } from "@/components/TopAiringSection";
import { HomepageHighlights } from "@/components/HomepageHighlights";
import { getHomeData } from '@/lib/home';
import { RefreshListings } from '@/components/RefreshListings';
import type { RecentItem, PopularItem } from '@/lib/api-types';
import { NoticeToast } from '@/components/ui/toast';

// Render week boundaries and cached public-page metadata on request.
export const dynamic = "force-dynamic";

function LatestEpisodes({ items }: { items: RecentItem[] }) {
  return items.length ? <div className="homepage-grid">{items.map(item => <DramaCard key={item["episode-link"]} item={item} variant="recent" />)}</div> : <p className="source-empty">No episodes are listed right now.</p>;
}

function PopularPreview({ items }: { items: PopularItem[] }) {
  return items.length ? <div className="homepage-grid">{items.map(item => <DramaCard key={item["detail-link"]} item={item} variant="popular" />)}</div> : <p className="source-empty">No popular dramas are listed right now.</p>;
}

export default async function Home() {
  if (webRuntime()) return <ReaderPage view="home" />;
  const data = await getHomeData();
  return <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 w-full items-start">
    <RefreshListings enabled={data.partial} />
    <div className="flex-1 animate-fade-in min-w-0 space-y-8 sm:space-y-12">
      <Suspense fallback={null}><ContinueWatching /></Suspense>
      <NoticeToast enabled={data.partial} id="home-partial" message="Some listings are temporarily unavailable. We’ll keep checking for updates."/>
      <section id="recent" className="space-y-4 sm:space-y-6 scroll-mt-24">
        <div className="flex items-center justify-between"><h2 className="text-xl sm:text-2xl font-bold heading">Latest Episodes</h2><Link href="/recently-added" className="glass-btn group !px-3 sm:!px-4 !py-2 text-sm sm:text-base">View all <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">›</span></Link></div>
        <LatestEpisodes items={data.recent} />
      </section>
      <section id="popular" className="space-y-4 sm:space-y-6 scroll-mt-24">
        <div className="flex items-center justify-between"><h2 className="text-xl sm:text-2xl font-bold heading">Popular Dramas</h2><Link href="/popular" className="glass-btn group !px-3 sm:!px-4 !py-2 text-sm sm:text-base">View all <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">›</span></Link></div>
        <PopularPreview items={data.popular} />
      </section>
    </div>
    <div className="w-full lg:w-80 xl:w-96 shrink-0 space-y-5"><TopAiringSection result={data.rankings} /><HomepageHighlights home={data.home} /></div>
  </div>;
}
