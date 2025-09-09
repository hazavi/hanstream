import { fetchDrama, DramaResponse } from "../../lib/api";
import { formatRelativeTime } from "../../lib/api";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  let resolvedParams: { slug: string };
  if (typeof params === "object" && params !== null && "then" in params) {
    resolvedParams = await params;
  } else {
    resolvedParams = params as { slug: string };
  }
  try {
    const data = await fetchDrama(resolvedParams.slug);
    return {
      title:
        (data.result && typeof data.result.title === "string"
          ? data.result.title
          : undefined) || resolvedParams.slug,
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
  episodes?: { id: string; type?: string; time?: string }[];
  meta?: Record<string, unknown>;
}

export default async function DramaDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  let resolvedParams: { slug: string };
  if (typeof params === "object" && params !== null && "then" in params) {
    resolvedParams = await params;
  } else {
    resolvedParams = params as { slug: string };
  }
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
      ? (base.episodes as { id: string; type?: string; time?: string }[])
      : undefined,
    meta: rootMeta || undefined,
  };
  return (
    <div className="max-w-5xl mx-auto space-y-10">
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
            <Image
              src={detail.image}
              alt={detail.title}
              width={520}
              height={700}
              className="w-full h-auto rounded-2xl object-cover aspect-[3/4] bg-neutral-100 dark:bg-neutral-800 shadow-lg"
              priority
            />
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
                          {key}
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
                          {key}
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
            <div className="bg-transparent backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl p-4">
              <div
                className="prose prose-neutral dark:prose-invert max-w-none text-secondary leading-relaxed text-sm"
                dangerouslySetInnerHTML={{ __html: detail.description }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Controls section like: Add to favorite/list, Mark as Watching, Paused and Finish */}

      {/* Episodes Section */}
      {detail.episodes && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold heading">
              Episodes ({detail.episodes.length})
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {detail.episodes.map(
              (ep: { id: string; type?: string; time?: string }) => {
                const epNum = ep.id.split("/").filter(Boolean).pop();
                return (
                  <Link
                    key={ep.id}
                    href={`/${resolvedParams.slug}/episode/${epNum}`}
                    className="group block surface rounded-xl p-4 hover:surface-hover hover:shadow-md transition-all duration-200"
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
                        {ep.time && (
                          <p className="text-xs faint">
                            {formatRelativeTime(ep.time)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              }
            )}
          </div>
        </section>
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
