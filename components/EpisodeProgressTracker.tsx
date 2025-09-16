"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
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
  const { user } = useAuth();
  const { profile, addToContinueWatching, updateContinueWatchingProgress } =
    useProfile();

  useEffect(() => {
    if (!user || !profile) {
      return;
    }

    const episodeNum = parseInt(episode, 10);
    if (isNaN(episodeNum)) {
      return;
    }

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
          await updateContinueWatchingProgress(slug, episodeNum, totalEpisodes);
        } else {
          // Add to continue watching if not already there
          await addToContinueWatching({
            slug,
            title,
            image,
            currentEpisode: episodeNum,
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
    user,
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
