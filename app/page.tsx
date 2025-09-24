import { Suspense } from "react";
import Link from "next/link";
import { DramaCard } from "@/components/DramaCard";
import { ContinueWatching } from "@/components/ContinueWatching";
import { TopAiringSection } from "@/components/TopAiringSection";
import {
  fetchRecentCached,
  fetchPopularCached,
  RecentItem,
  PopularItem,
} from "@/lib/api";

function GridSkeleton() {
  return (
    <div className="grid gap-3 grid-cols-3 sm:gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="rounded-xl bg-gray-200/60 dark:bg-gray-800/30 aspect-[3/4] shimmer"></div>
          <div className="p-2 sm:p-3 space-y-1 sm:space-y-2">
            <div className="h-3 sm:h-4 bg-gray-200/60 dark:bg-gray-800/30 rounded shimmer"></div>
            <div className="h-2 sm:h-3 bg-gray-200/40 dark:bg-gray-800/20 rounded w-2/3 shimmer"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface RecentResponse {
  results: RecentItem[];
}
interface PopularResponse {
  results: PopularItem[];
}

async function RecentPreview() {
  const data: RecentResponse = await fetchRecentCached();
  return (
    <div className="grid gap-3 grid-cols-3 sm:gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5">
      {data.results.slice(0, 10).map((d) => (
        <DramaCard key={d["episode-link"]} item={d} variant="recent" />
      ))}
    </div>
  );
}

async function PopularPreview() {
  const data: PopularResponse = await fetchPopularCached();
  return (
    <div className="grid gap-3 grid-cols-3 sm:gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5">
      {data.results.slice(0, 10).map((d) => (
        <DramaCard key={d["detail-link"]} item={d} variant="popular" />
      ))}
    </div>
  );
}

export default async function Home() {
  return (
    <div className="flex gap-8">
      <div className="flex-1 animate-fade-in space-y-12">
        <section className="space-y-6">
          <div className="text-center space-y-4 py-8">
            <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-100">
              Asian Dramas
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Discover the latest episodes and most popular ongoing Asian
              dramas.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="flex gap-2 p-1 rounded-2xl glass-surface">
              <a
                href="#recent"
                className="glass-btn !bg-neutral-900 !text-white dark:!bg-white dark:!text-neutral-900"
              >
                Recently Added
              </a>
              <a href="#popular" className="glass-btn">
                Popular
              </a>
            </div>
          </div>

          {/* Continue Watching Section - Only shown for logged in users */}
          <Suspense fallback={null}>
            <ContinueWatching />
          </Suspense>

          <div id="recent" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold heading">Latest Episodes</h2>
              </div>
              <Link
                href="/recently-added"
                className="glass-btn group !px-4 !py-2"
              >
                View all
                <svg
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
            <Suspense fallback={<GridSkeleton />}>
              <RecentPreview />
            </Suspense>
          </div>
        </section>

        <section id="popular" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold heading">Popular Dramas</h2>
            </div>
            <Link href="/popular" className="glass-btn group !px-4 !py-2">
              View all
              <svg
                className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
          <Suspense fallback={<GridSkeleton />}>
            <PopularPreview />
          </Suspense>
        </section>
      </div>

      {/* TopAiringSection - Only on homepage */}
      <div className="hidden lg:block">
        <TopAiringSection />
      </div>
    </div>
  );
}
