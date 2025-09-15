"use client";
import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import type { RecentItem, PopularItem } from "../lib/api";
import { formatRelativeTime } from "../lib/api";

type DramaCardProps =
  | { item: RecentItem; variant: "recent" }
  | { item: PopularItem; variant: "popular" };

function DramaImage({
  src,
  alt,
  ...props
}: {
  src: string;
  alt: string;
  [key: string]: unknown;
}) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleLoad = () => {
    setLoading(false);
    setImageLoaded(true);
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Enhanced skeleton with shimmer effect */}
      {loading && !error && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent animate-shimmer" />
          {/* Skeleton content indicators */}
          <div className="absolute bottom-3 left-3 right-3 space-y-2">
            <div className="h-3 bg-white/30 dark:bg-black/30 rounded animate-pulse" />
            <div className="h-2 bg-white/20 dark:bg-black/20 rounded w-3/4 animate-pulse" />
          </div>
        </div>
      )}

      {/* Error state with better styling */}
      {error && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center p-4">
            <div className="w-12 h-12 mx-auto mb-2 opacity-50">
              <svg
                fill="currentColor"
                viewBox="0 0 20 20"
                className="text-gray-400 dark:text-gray-600"
              >
                <path
                  fillRule="evenodd"
                  d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Image unavailable
            </p>
          </div>
        </div>
      )}

      {/* Main image with smooth fade-in */}
      <Image
        src={error ? "/file.svg" : src}
        alt={alt}
        onError={handleError}
        onLoad={handleLoad}
        className={`transition-opacity duration-300 ${
          imageLoaded ? "opacity-100" : "opacity-0"
        } ${props.className || ""}`}
        {...(props as any)}
        style={{
          ...((props as any)?.style || {}),
        }}
      />
    </div>
  );
}

export function DramaCard({ item, variant }: DramaCardProps) {
  if (variant === "recent") {
    const d = item as RecentItem;
    const slug = d["episode-link"].split("/").filter(Boolean)[0];
    const episodeNum = d.episode_number;
    return (
      <Link
        href={`/${slug}/episode/${episodeNum}`}
        className="group block animate-slide-up"
      >
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl glass-card card-hover">
          <div className="relative aspect-[4/5] overflow-hidden">
            <DramaImage
              src={d.image}
              alt={d.title}
              fill
              sizes="(max-width:640px) 33vw, (max-width:768px) 25vw, (max-width:1200px) 20vw, 16vw"
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
              priority={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex gap-1 sm:gap-2">
              <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-md sm:rounded-lg bg-black/70 text-white backdrop-blur-sm">
                EP {episodeNum}
              </span>
              <span
                className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-md sm:rounded-lg ${
                  d.type === "SUB"
                    ? "bg-blue-500 text-white"
                    : d.type === "DUB"
                    ? "bg-green-500 text-white"
                    : "bg-purple-500 text-white"
                }`}
              >
                {d.type}
              </span>
            </div>

            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg
                  className="w-3 h-3 sm:w-4 sm:h-4 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="p-2 sm:p-3 md:p-4 space-y-1 sm:space-y-2">
            <h3
              className="text-xs sm:text-sm font-semibold leading-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
              title={d.title}
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {d.title}
            </h3>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500"></div>
              <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">
                {formatRelativeTime(d.time)}
              </p>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  const p: PopularItem = item;
  const slug = p["detail-link"].replace(/^\//, "");
  return (
    <Link href={`/${slug}`} className="group block animate-slide-up">
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl glass-card card-hover">
        <div className="relative aspect-[4/5] overflow-hidden">
          <DramaImage
            src={p.image}
            alt={p.title}
            priority={false} // Popular items load lazily
            fill
            sizes="(max-width:640px) 33vw, (max-width:768px) 25vw, (max-width:1200px) 20vw, 16vw"
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg
                className="w-3 h-3 sm:w-4 sm:h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="p-2 sm:p-3 md:p-4">
          <h3
            className="text-xs sm:text-sm font-semibold leading-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
            title={p.title}
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {p.title}
          </h3>
        </div>
      </div>
    </Link>
  );
}
