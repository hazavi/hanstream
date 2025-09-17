"use client";

import Link from "next/link";

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

  // Fix navigation logic - episodes are in descending order (newest first)
  // So prev episode has HIGHER index, next episode has LOWER index
  const nextEpisode = currentEpIndex > 0 ? episodes[currentEpIndex - 1] : null;
  const prevEpisode =
    currentEpIndex < episodes.length - 1 ? episodes[currentEpIndex + 1] : null;

  const prevEpNum = prevEpisode?.id.split("/").filter(Boolean).pop();
  const nextEpNum = nextEpisode?.id.split("/").filter(Boolean).pop();

  return (
    <div className="flex justify-end items-center gap-2">
      {/* Previous Episode Button */}
      {prevEpisode && (
        <Link
          href={`/${slug}/episode/${prevEpNum}`}
          className="flex items-center gap-1 px-3 py-2 hover:bg-black/10 rounded-md transition-all duration-200 text-sm font-medium text-gray-300 hover:text-white"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Prev
        </Link>
      )}

      {/* Next Episode Button */}
      {nextEpisode && (
        <Link
          href={`/${slug}/episode/${nextEpNum}`}
          className="flex items-center gap-1 px-3 py-2 hover:bg-black/10 rounded-md transition-all duration-200 text-sm font-medium text-gray-300 hover:text-white"
        >
          Next
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      )}
    </div>
  );
}
