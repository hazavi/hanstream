"use client";
import { useState, useMemo, useCallback, memo } from "react";
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

// Memoize individual episode item to prevent unnecessary re-renders
const EpisodeItem = memo(function EpisodeItem({
  episode: e,
  dramaSlug,
  currentEpisode,
  epNum,
  active,
}: {
  episode: Episode;
  dramaSlug: string;
  currentEpisode: string;
  epNum: string | undefined;
  active: boolean;
}) {
  return (
    <Link
      href={`/${dramaSlug}/episode/${epNum}`}
      className={`group relative rounded-md font-medium transition-all duration-200 flex-shrink-0 ${
        active
          ? "glass-card hover:ring-1 hover:ring-accent/30"
          : "glass-card hover:ring-1 hover:ring-accent/30"
      }`}
      prefetch={false} // Disable prefetch to improve performance
    >
      <div
        className={`flex items-center justify-between gap-2 ${
          active ? "px-2 py-1.5" : "px-2 py-1.5"
        }`}
      >
        {/* Left: Episode Number */}
        <div className="flex items-center gap-1.5 min-w-0">
          {active && (
            <svg
              className="w-4 h-4 text-blue-500 dark:text-accent flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          )}

          <div
            className={`flex items-center justify-center w-6 h-6 rounded flex-shrink-0 ${
              active ? "dark:bg-accent/20" : "bg-surface/50"
            }`}
          >
            <span
              className={`text-[10px] font-bold ${
                active
                  ? "text-blue-600 dark:text-accent"
                  : "text-primary"
              }`}
            >
              {epNum}
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <span
              className={`text-[10px] font-medium truncate ${
                active
                  ? "text-blue-600 dark:text-accent"
                  : "text-primary"
              }`}
            >
              Episode {epNum}
            </span>
            {e.time && (
              <span className="text-[9px] text-secondary truncate">
                {formatRelativeTime(e.time)}
              </span>
            )}
          </div>
        </div>

        {/* Right: Type Badge */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {e.type && (
            <span
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase ${
                e.type === "SUB"
                  ? active
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-blue-500/10 text-blue-500"
                  : active
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-purple-500/10 text-purple-500"
              }`}
            >
              {e.type}
            </span>
          )}
        </div>
      </div>

      {/* Active Indicator */}
      {active && (
        <div className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
      )}
    </Link>
  );
});

export function EpisodesNavigation({
  episodes,
  currentEpisode,
  dramaSlug,
}: EpisodesNavigationProps) {
  // Memoize processed episodes data
  const episodeData = useMemo(() => {
    return episodes.map((e) => {
      const epNum = e.id.split("/").filter(Boolean).pop();
      const active = epNum === currentEpisode;
      return { episode: e, epNum, active };
    });
  }, [episodes, currentEpisode]);

  return (
    <section className="space-y-2 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold heading">
          Episodes{" "}
          <span className="text-xs text-secondary ml-1">
            ({episodes.length})
          </span>
        </h2>
      </div>

      <div className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent hover:scrollbar-thumb-white/50">
        {episodeData.map(({ episode: e, epNum, active }, index) => {
          return (
            <EpisodeItem
              key={e.id}
              episode={e}
              dramaSlug={dramaSlug}
              currentEpisode={currentEpisode}
              epNum={epNum}
              active={active}
            />
          );
        })}
      </div>
    </section>
  );
}
