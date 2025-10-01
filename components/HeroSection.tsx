import { Suspense } from "react";
import { HeroCarousel } from "@/components/HeroCarousel";
import { fetchHotSeriesCached, HotSeriesResponse } from "@/lib/api";

function HeroSkeleton() {
  return (
    <div className="relative h-96 surface animate-pulse">
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20" />
      <div className="relative z-10 h-full flex items-center">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="max-w-2xl space-y-4">
            <div className="w-24 h-6 bg-gray-400 dark:bg-gray-600 rounded-full" />
            <div className="w-96 h-12 bg-gray-400 dark:bg-gray-600 rounded-lg" />
            <div className="w-64 h-6 bg-gray-400 dark:bg-gray-600 rounded" />
            <div className="flex gap-4">
              <div className="w-32 h-12 bg-gray-400 dark:bg-gray-600 rounded-lg" />
              <div className="w-32 h-12 bg-gray-400 dark:bg-gray-600 rounded-lg" />
            </div>
          </div>
        </div>
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
