"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface VideoControlsProps {
  episodes: { id: string }[];
  currentEpisode: string;
  slug: string;
}

export function VideoControls({
  episodes,
  currentEpisode,
  slug,
}: VideoControlsProps) {
  const currentEpIndex = episodes.findIndex(
    (ep) => ep.id.split("/").filter(Boolean).pop() === currentEpisode
  );

  const prevEpisode = currentEpIndex > 0 ? episodes[currentEpIndex - 1] : null;
  const nextEpisode = currentEpIndex >= 0 && currentEpIndex < episodes.length - 1 ? episodes[currentEpIndex + 1] : null;

  const prevEpNum = prevEpisode?.id.split("/").filter(Boolean).pop();
  const nextEpNum = nextEpisode?.id.split("/").filter(Boolean).pop();

  return (
    <div className="episode-navigation flex justify-end items-center gap-2">
      {/* Previous Episode Button */}
      {prevEpisode && (
        <Link
          href={`/${slug}/episode/${prevEpNum}`}
          className="glass-btn flex items-center gap-1 !px-3 !py-2 text-sm"
        >
          <ChevronLeft size={14} aria-hidden="true"/>
          Prev
        </Link>
      )}

      {/* Next Episode Button */}
      {nextEpisode && (
        <Link
          href={`/${slug}/episode/${nextEpNum}`}
          className="glass-btn flex items-center gap-1 !px-3 !py-2 text-sm"
        >
          Next
          <ChevronRight size={14} aria-hidden="true"/>
        </Link>
      )}
    </div>
  );
}
