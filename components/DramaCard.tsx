"use client";
import { Artwork } from "./Artwork";
import Link from "next/link";
import type { RecentItem, PopularItem } from "../lib/api";
import { formatRelativeTime } from "../lib/format";
import { CirclePlay, Info } from 'lucide-react';

type DramaCardProps =
  | { item: RecentItem; variant: "recent" }
  | { item: PopularItem; variant: "popular" };

export function DramaCard({ item, variant }: DramaCardProps) {
  if (variant === "recent") {
    const d = item as RecentItem;
    const episodeNum = d.episode_number;

    const href = d["episode-link"];

    return (
      <Link href={href} className="group block animate-slide-up">
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl glass-card card-hover">
          <div className="relative aspect-[4/5] overflow-hidden">
            <Artwork sources={[d.image, ...(d.poster_fallbacks || [])]} alt={d.title} title={d.title} year={Number(d["episode-link"].match(/--(\d{4})/)?.[1]) || undefined} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex gap-1 sm:gap-2">
              <span className="drama-type-badge px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs font-semibold">
                {episodeNum ? `EP ${episodeNum}` : d.type === "Movie" ? "Movie" : "Show"}
              </span>
              <span
                className="drama-type-badge px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs font-semibold"
              >
                {d.type}
              </span>
            </div>

            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <CirclePlay className="w-3 h-3 sm:w-4 sm:h-4 text-white" aria-hidden="true"/>
              </div>
            </div>
          </div>

          <div className="p-2 sm:p-3 md:p-4 space-y-1 sm:space-y-2">
            <h3
              className="text-xs sm:text-sm font-semibold leading-tight truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-400 transition-colors"
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
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-neutral-500"></div>
              <p className="text-[10px] sm:text-xs text-neutral-600 dark:text-neutral-400">
                {formatRelativeTime(d.time)}
              </p>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  const p: PopularItem = item;
  return (
    <Link href={p["detail-link"]} className="group block animate-slide-up">
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl glass-card card-hover">
        <div className="relative aspect-[4/5] overflow-hidden">
          <Artwork sources={[p.image, ...(p.poster_fallbacks || [])]} alt={p.title} title={p.title} year={Number(p["detail-link"].match(/--(\d{4})/)?.[1]) || undefined} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Info className="w-3 h-3 sm:w-4 sm:h-4 text-white" aria-hidden="true"/>
            </div>
          </div>
        </div>

        <div className="p-2 sm:p-3 md:p-4">
          <h3
            className="text-xs sm:text-sm font-semibold leading-tight truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-400 transition-colors"
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
