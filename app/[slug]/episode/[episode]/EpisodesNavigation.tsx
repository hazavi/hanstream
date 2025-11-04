"use client";
import { useState } from "react";
import Link from "next/link";
import { formatRelativeTime } from "../../../../lib/api";

interface Episode {
  id: string;
  title?: string;
  type?: string;
  time?: string;
}

interface EpisodesNavigationProps {
  episodes: Episode[];
  currentEpisode: string;
  dramaSlug: string;
}

export function EpisodesNavigation({
  episodes,
  currentEpisode,
  dramaSlug,
}: EpisodesNavigationProps) {
  const [showAll, setShowAll] = useState(false);
  const displayedEpisodes = showAll ? episodes : episodes.slice(0, 12);
  const hasMore = episodes.length > 12;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold heading">
          All Episodes ({episodes.length})
        </h2>
      </div>

      <div className="grid gap-2 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
        {displayedEpisodes.map((e) => {
          const epNum = e.id.split("/").filter(Boolean).pop();
          const active = epNum === currentEpisode;
          return (
            <Link
              key={e.id}
              href={`/${dramaSlug}/episode/${epNum}`}
              className={`group relative rounded-lg text-xs font-medium transition-all duration-200 overflow-hidden
                ${active ? "episode-active" : "episode-inactive"}`}
            >
              <div className="p-1.5 space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold subtle">EP</span>
                  {e.type && (
                    <span
                      className={`text-[9px] px-1 py-0.5 rounded ${
                        e.type === "SUB"
                          ? active
                            ? "badge-soft-sub"
                            : "badge-sub"
                          : active
                          ? "badge-soft-dub"
                          : "badge-dub"
                      }`}
                    >
                      {e.type}
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold">{epNum}</span>
                </div>
                {e.time && (
                  <div className="text-[10px] faint text-center truncate">
                    {formatRelativeTime(e.time)}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {hasMore && !showAll && (
        <div className="flex justify-center">
          <button onClick={() => setShowAll(true)} className="glass-btn">
            <span>View All Episodes</span>
          </button>
        </div>
      )}

      {showAll && hasMore && (
        <div className="flex justify-center">
          <button onClick={() => setShowAll(false)} className="glass-btn">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
            <span>Show Less</span>
          </button>
        </div>
      )}
    </section>
  );
}
