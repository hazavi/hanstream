import { Suspense } from "react";
import Link from "next/link";
import { DramaCard } from "@/components/DramaCard";
import { ContinueWatching } from "@/components/ContinueWatching";
import { TopAiringSection } from "@/components/TopAiringSection";
import { HeroSection } from "@/components/HeroSection";
import {
  fetchRecentCached,
  fetchPopularCached,
  RecentItem,
  PopularItem,
} from "@/lib/api";

function GridSkeleton() {
  return (
    <div className="homepage-grid">
      {Array.from({ length: 12 }).map((_, i) => (
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
    <div className="homepage-grid">
      {data.results.slice(0, 12).map((d) => (
        <DramaCard key={d["episode-link"]} item={d} variant="recent" />
      ))}
    </div>
  );
}

async function PopularPreview() {
  try {
    const data: PopularResponse = await fetchPopularCached();

    // Add debugging
    console.log("Popular data:", data);

    if (!data || !data.results || !Array.isArray(data.results)) {
      console.error("Invalid popular data structure:", data);
      return (
        <div className="homepage-grid">
          <div className="col-span-full text-center p-8 text-secondary">
            No popular dramas available
          </div>
        </div>
      );
    }

    if (data.results.length === 0) {
      return (
        <div className="homepage-grid">
          <div className="col-span-full text-center p-8 text-secondary">
            No popular dramas found
          </div>
        </div>
      );
    }

    return (
      <div className="homepage-grid">
        {data.results.slice(0, 12).map((d) => (
          <DramaCard key={d["detail-link"]} item={d} variant="popular" />
        ))}
      </div>
    );
  } catch (error) {
    console.error("Error fetching popular dramas:", error);
    return (
      <div className="homepage-grid">
        <div className="col-span-full text-center p-8 text-red-500">
          Error loading popular dramas
        </div>
      </div>
    );
  }
}

export default async function Home() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 w-full overflow-x-hidden">
      <div className="flex-1 animate-fade-in space-y-8 sm:space-y-12 min-w-0">
        {/* Hero Carousel Section */}
        <HeroSection />

        <section className="space-y-4 sm:space-y-6">
          <div className="flex justify-center">
            <div className="flex gap-2 p-1 rounded-xl sm:rounded-2xl glass-surface">
              <a
                href="#recent"
                className="glass-btn !bg-neutral-900 !text-white dark:!bg-white dark:!text-neutral-900 text-sm sm:text-base px-3 sm:px-4 py-2"
              >
                Recently Added
              </a>
              <a
                href="#popular"
                className="glass-btn text-sm sm:text-base px-3 sm:px-4 py-2"
              >
                Popular
              </a>
            </div>
          </div>

          {/* Continue Watching Section - Only shown for logged in users */}
          <Suspense fallback={null}>
            <ContinueWatching />
          </Suspense>

          <div id="recent" className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold heading">
                  Latest Episodes
                </h2>
              </div>
              <Link
                href="/recently-added"
                className="glass-btn group !px-3 sm:!px-4 !py-2 text-sm sm:text-base"
              >
                <span className="hidden sm:inline">View all</span>
                <span className="sm:hidden">All</span>
                <svg
                  className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform"
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

        <section id="popular" className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold heading">
                Popular Dramas
              </h2>
            </div>
            <Link
              href="/popular"
              className="glass-btn group !px-3 sm:!px-4 !py-2 text-sm sm:text-base"
            >
              <span className="hidden sm:inline">View all</span>
              <span className="sm:hidden">All</span>
              <svg
                className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform"
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

      {/* TopAiringSection - Hidden on mobile, shown on large screens */}
      <div className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0">
        <TopAiringSection />
      </div>
    </div>
  );
}
