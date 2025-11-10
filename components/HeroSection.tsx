import { Suspense } from "react";
import { HeroCarousel } from "@/components/HeroCarousel";
import { fetchHotSeriesCached, HotSeriesResponse } from "@/lib/api";

function HeroSkeleton() {
  return (
    <div className="relative h-48 sm:h-56 md:h-64 lg:h-70 overflow-hidden bg-transparent animate-pulse">
      <div className="flex h-full">
        {/* Left side - Content */}
        <div className="flex-[2] sm:flex-[2] flex items-center">
          <div className="px-4 sm:px-6 lg:px-12 xl:px-20 py-4 sm:py-6 lg:py-8">
            <div className="max-w-xl lg:max-w-2xl space-y-3 sm:space-y-4">
              <div className="w-20 sm:w-24 h-5 sm:h-6 bg-gray-300 dark:bg-gray-700 rounded-full" />
              <div className="w-64 sm:w-80 md:w-96 h-8 sm:h-10 md:h-12 bg-gray-300 dark:bg-gray-700 rounded-lg" />
              <div className="w-48 sm:w-56 md:w-64 h-5 sm:h-6 bg-gray-300 dark:bg-gray-700 rounded" />
              <div className="flex gap-2 pt-2">
                <div className="w-20 sm:w-28 h-8 sm:h-10 bg-gray-300 dark:bg-gray-700 rounded-lg" />
                <div className="w-16 sm:w-24 h-8 sm:h-10 bg-gray-300 dark:bg-gray-700 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
        {/* Right side - Image placeholder */}
        <div className="flex-1 relative max-w-xs sm:max-w-sm lg:max-w-lg bg-gray-300 dark:bg-gray-700" />
      </div>
    </div>
  );
}

async function HotSeriesHero() {
  try {
    const data: HotSeriesResponse = await fetchHotSeriesCached();

    if (data.error || !data.result?.updates?.length) {
      return (
        <div className="relative h-70 surface flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-2">
              Hot Series Coming Soon
            </h2>
            <p className="text-muted-foreground">
              Stay tuned for the latest updates!
            </p>
          </div>
        </div>
      );
    }

    return <HeroCarousel items={data.result.updates} />;
  } catch (error) {
    console.error("Failed to fetch hot series:", error);
    return (
      <div className="relative h-60 surface flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Unable to Load
          </h2>
          <p className="text-muted-foreground">Please try again later</p>
        </div>
      </div>
    );
  }
}

export function HeroSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 mb-20">
      <Suspense fallback={<HeroSkeleton />}>
        <HotSeriesHero />
      </Suspense>
    </section>
  );
}
