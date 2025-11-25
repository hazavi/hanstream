import { fetchDrama, fetchPopular, DramaResponse } from "../../lib/api";
import { formatRelativeTime } from "../../lib/api";
import { WatchlistButton } from "@/components/WatchlistButton";
import { DescriptionSection } from "@/components/DescriptionSection";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DramaRatingButton } from "@/components/DramaRatingButton";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Suspense } from "react";

// Generate static paths for popular dramas at build time
export async function generateStaticParams() {
  try {
    const data = await fetchPopular(1);
    const slugs = data.results
      .slice(0, 20) // Pre-generate top 20 popular dramas
      .map((item) => ({
        slug: item["detail-link"].split("/").filter(Boolean).pop() || "",
      }))
      .filter((item) => item.slug);
    return slugs;
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  try {
    const data = await fetchDrama(resolvedParams.slug);
    const title =
      (data.result && typeof data.result.title === "string"
        ? data.result.title
        : undefined) || resolvedParams.slug;
    const description =
      typeof data.result?.description === "string"
        ? data.result.description.slice(0, 160)
        : undefined;
    const image =
      typeof data.result?.image === "string" ? data.result.image : undefined;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: image ? [{ url: image }] : [],
      },
    };
  } catch {
    return { title: resolvedParams.slug };
  }
}

interface DramaDetail {
  title: string;
  image?: string;
  description?: string;
  other_names?: string;
  episodes?: {
    episode: number;
    episode_link: string;
    type?: string;
    release_date?: string;
    title?: string;
  }[];
  meta?: Record<string, unknown>;
}

export default async function DramaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const data: DramaResponse = await fetchDrama(resolvedParams.slug);
  // Build a normalized detail object
  const base = (data.result || {}) as Record<string, unknown>;
  const rootImage = ((): string | undefined => {
    const candidate = (data as unknown as { image?: unknown }).image;
    return typeof candidate === "string" ? candidate : undefined;
  })();
  const rootMeta = ((): Record<string, unknown> | undefined => {
    const candidate = (base.meta as unknown) || undefined;
    return candidate && typeof candidate === "object"
      ? (candidate as Record<string, unknown>)
      : undefined;
  })();

  const detail: DramaDetail = {
    title:
      typeof base.title === "string"
        ? base.title
        : resolvedParams.slug.replace(/-/g, " "),
    image:
      rootImage || (typeof base.image === "string" ? base.image : undefined),
    description:
      typeof base.description === "string" ? base.description : undefined,
    other_names:
      typeof base.other_names === "string" ? base.other_names : undefined,
    episodes: Array.isArray(base.episodes)
      ? (base.episodes as {
          episode: number;
          episode_link: string;
          type?: string;
          release_date?: string;
          title?: string;
        }[])
      : undefined,
    meta: rootMeta || undefined,
  };
  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: detail.title, isActive: true },
        ]}
      />

      {/* Title Section */}
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold heading leading-tight">
          {detail.title}
        </h1>
      </div>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Poster + Meta */}
        <div className="flex-shrink-0 flex flex-col gap-4 w-72 lg:w-80">
          {/* Poster Image */}
          {detail.image && (
            <div className="relative">
              <Image
                src={detail.image}
                alt={detail.title}
                width={520}
                height={700}
                className="w-full h-auto rounded-2xl object-cover aspect-[3/4] bg-neutral-100 dark:bg-neutral-800 shadow-lg"
                priority
              />
              <WatchlistButton
                slug={resolvedParams.slug}
                title={detail.title}
                image={detail.image}
              />
              <DramaRatingButton
                slug={resolvedParams.slug}
                title={detail.title}
                image={detail.image}
              />
            </div>
          )}

          {/* Meta Information Section (Below Image, Full Width) */}
          {detail.meta && (
            <div className="drama-meta bg-transparent backdrop-blur-xl border-white/20 dark:border-white/10 rounded-lg p-3 w-full">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] w-full">
                {Object.entries(detail.meta)
                  .filter(([key]) =>
                    ["duration", "episodes", "released", "status"].includes(
                      key.toLowerCase()
                    )
                  )
                  .map(([key, value]) => {
                    const displayValue = String(value);
                    return (
                      <div key={key} className="flex flex-col">
                        <dt className="font-medium text-gray-400 dark:text-gray-500">
                          {key.replace(/_/g, " ")}
                        </dt>
                        <dd className="text-[13px] text-primary dark:text-white leading-tight">
                          {displayValue}
                        </dd>
                      </div>
                    );
                  })}
              </dl>
            </div>
          )}
        </div>

        {/* Right Column (Other Names + Description) */}
        <div className="flex-1 flex flex-col space-y-3">
          {/* Other Names Section */}
          {detail.other_names && (
            <div className="bg-transparent backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl p-4">
              <p className="text-xs text-secondary leading-relaxed">
                {detail.other_names}
              </p>
            </div>
          )}

          {/* Meta Information Section */}
          {detail.meta && (
            <div className="drama-meta bg-transparent backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-lg p-4">
              <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[11px]">
                {Object.entries(detail.meta)
                  .filter(
                    ([key]) =>
                      !["duration", "episodes", "released", "status"].includes(
                        key.toLowerCase()
                      )
                  )
                  .map(([key, value]) => {
                    const displayValue =
                      key.toLowerCase() === "genre"
                        ? String(value)
                            .split(";")
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .join(", ")
                        : String(value);
                    return (
                      <div key={key} className="flex flex-col">
                        <dt className="font-medium text-gray-400 dark:text-gray-500">
                          {key.replace(/_/g, " ")}
                        </dt>
                        <dd className="text-[11px] text-primary dark:text-white leading-tight">
                          {displayValue}
                        </dd>
                      </div>
                    );
                  })}
              </dl>
            </div>
          )}

          {/* Description Section */}
          {detail.description && (
            <DescriptionSection description={detail.description} />
          )}
        </div>
      </div>

      {/* Episodes Section */}
      {detail.episodes && (
        <Suspense
          fallback={
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold heading">Episodes</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="surface rounded-xl p-4 animate-pulse">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-300 dark:bg-gray-700" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
                        <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          }
        >
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold heading">
                Episodes ({detail.episodes.length})
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {detail.episodes.map((ep, index) => {
                // Handle cases where episode_link might be undefined or null
                if (!ep.episode_link) return null;

                const epNum = ep.episode;
                return (
                  <Link
                    key={`${ep.episode_link}-${index}-${epNum}`}
                    href={`/${resolvedParams.slug}/episode/${epNum}`}
                    className="group block surface rounded-xl p-4 hover:surface-hover hover:shadow-md transition-all duration-200"
                    prefetch={index < 12} // Only prefetch first 12 episodes
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg glass-surface flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {epNum}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-primary truncate hover:text-accent transition-colors">
                            Episode {epNum}
                          </p>
                          {ep.type && (
                            <span
                              className={`badge ${
                                ep.type === "SUB" ? "badge-sub" : "badge-dub"
                              }`}
                            >
                              {ep.type}
                            </span>
                          )}
                        </div>
                        {ep.release_date && (
                          <p className="text-xs faint">
                            {formatRelativeTime(ep.release_date)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </Suspense>
      )}

      {/* Drama Recommendations Section */}

      {/* <section className="space-y-6">
        <h2 className="text-2xl font-bold heading">You Might Also Like</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Map through recommended dramas
        </div>
      </section>    */}
    </div>
  );
}
