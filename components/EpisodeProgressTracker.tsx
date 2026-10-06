"use client";

import { useEffect, useRef } from "react";
import { useProfile } from "@/lib/profile";

interface EpisodeProgressTrackerProps {
  slug: string;
  episode: string;
  title: string;
  image?: string;
  totalEpisodes?: number;
}

export function EpisodeProgressTracker({
  slug,
  episode,
  title,
  image,
  totalEpisodes,
}: EpisodeProgressTrackerProps) {
  const { profile, addToContinueWatching, updateContinueWatchingProgress } =
    useProfile();
  const recordedRoute = useRef<string | null>(null);

  useEffect(() => {
    if (!profile || recordedRoute.current === `${slug}/${episode}`) {
      return;
    }

    const episodeNum = Number(/^s\d+e(\d+)$/i.exec(episode)?.[1] || episode);
    if (isNaN(episodeNum)) {
      return;
    }
    recordedRoute.current = `${slug}/${episode}`;

    const updateProgress = async () => {
      try {
        // Check if drama is already in continue watching
        const continueWatchingList = Array.isArray(profile.continueWatching)
          ? profile.continueWatching
          : [];
        const existingItem = continueWatchingList.find(
          (item) => item.slug === slug
        );

        if (existingItem) {
          // Always update progress and last watched time, even if same episode
          await updateContinueWatchingProgress(slug, episodeNum, totalEpisodes, episode);
        } else {
          // Add to continue watching if not already there
          await addToContinueWatching({
            slug,
            title,
            image,
            currentEpisode: episodeNum,
            episodeRoute: episode,
            totalEpisodes,
            lastWatched: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Error updating episode progress:", error);
      }
    };

    // Add a small delay to ensure profile is fully loaded
    const timer = setTimeout(updateProgress, 1000);

    return () => clearTimeout(timer);
  }, [
    profile,
    slug,
    episode,
    title,
    image,
    totalEpisodes,
    addToContinueWatching,
    updateContinueWatchingProgress,
  ]);

  return null; // This component doesn't render anything
}
