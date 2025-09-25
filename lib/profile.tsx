"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./auth";
import { database } from "./firebase";
import { ref, set, onValue } from "firebase/database";
import {
  UserProfile,
  WatchlistItem,
  ContinueWatchingItem,
  TopRanking,
  WatchStatus,
  DEFAULT_PROFILE,
} from "./types";

interface ProfileContextType {
  profile: UserProfile | null;
  updateDisplayName: (name: string) => Promise<void>;
  updateProfilePicture: (pictureId: string) => Promise<void>;
  addToWatchlist: (item: Omit<WatchlistItem, "dateAdded">) => Promise<void>;
  updateWatchlistStatus: (slug: string, status: WatchStatus) => Promise<void>;
  removeFromWatchlist: (slug: string) => Promise<void>;
  rateItem: (slug: string, rating: number) => Promise<void>;
  updateTopRanking: (ranking: TopRanking) => Promise<void>;
  addToTopRanking: (
    rank: number,
    slug: string,
    title: string,
    image?: string,
    rating?: number,
    isPublic?: boolean
  ) => Promise<void>;
  removeFromTopRanking: (rank: number) => Promise<void>;
  reorderTopRankings: (fromRank: number, toRank: number) => Promise<void>;
  getWatchlistByStatus: (status: WatchStatus) => WatchlistItem[];
  // Continue watching functions
  addToContinueWatching: (
    item: Omit<ContinueWatchingItem, "dateAdded">
  ) => Promise<void>;
  updateContinueWatchingProgress: (
    slug: string,
    episode: number,
    totalEpisodes?: number
  ) => Promise<void>;
  removeFromContinueWatching: (slug: string) => Promise<void>;
  getContinueWatching: () => ContinueWatchingItem[];
  getDisplayName: () => string;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Load profile from Firebase when user changes
  useEffect(() => {
    if (user?.uid) {
      const profileRef = ref(database, `profiles/${user.uid}`);

      // Set up real-time listener
      const unsubscribe = onValue(
        profileRef,
        (snapshot) => {
          try {
            const data = snapshot.val();
            if (data) {
              // Ensure profile has all required properties with defaults
              const normalizedProfile: UserProfile = {
                ...DEFAULT_PROFILE,
                ...data,
                watchlist: Array.isArray(data.watchlist) ? data.watchlist : [],
                continueWatching: Array.isArray(data.continueWatching)
                  ? data.continueWatching
                  : [],
                topRankings: Array.isArray(data.topRankings)
                  ? data.topRankings
                  : [],
              };
              console.log("Profile loaded from Firebase");
              setProfile(normalizedProfile);
            } else {
              // Create default profile in Firebase
              const defaultProfile = { ...DEFAULT_PROFILE };
              set(profileRef, defaultProfile);
              setProfile(defaultProfile);
            }
          } catch (error) {
            console.error("Error loading profile:", error);
            // Set default profile if there's an error
            setProfile({ ...DEFAULT_PROFILE });
          }
        },
        (error) => {
          console.error("Firebase listener error:", error);
          // Set default profile if there's a connection error
          setProfile({ ...DEFAULT_PROFILE });
        }
      );

      // Cleanup listener
      return unsubscribe;
    } else {
      setProfile(null);
    }
  }, [user?.uid]);

  // Save profile to Firebase (also updates local state for immediate feedback)
  const saveProfileToFirebase = async (updatedProfile: UserProfile) => {
    if (user?.uid) {
      try {
        setProfile(updatedProfile); // Update local state immediately
        const profileRef = ref(database, `profiles/${user.uid}`);
        await set(profileRef, updatedProfile);
      } catch (error) {
        console.error("Error saving profile to Firebase:", error);
        // Note: Local state has already been updated for immediate feedback
        // The real-time listener will sync the correct state from Firebase
      }
    }
  };

  // Helper function to sanitize watchlist items for Firebase
  const sanitizeWatchlistItem = (
    item: Partial<WatchlistItem> & { status: WatchStatus }
  ): WatchlistItem => {
    return {
      slug: item.slug || "",
      title: item.title || "",
      image: item.image || "",
      status: item.status,
      dateAdded: item.dateAdded || new Date().toISOString(),
      // Only include progress if it exists and has valid properties
      ...(item.progress && {
        progress: {
          currentEpisode: item.progress.currentEpisode || 0,
          totalEpisodes: item.progress.totalEpisodes || 0,
          lastWatched: item.progress.lastWatched || new Date().toISOString(),
        },
      }),
      // Only include rating if it exists and is a number
      ...(typeof item.rating === "number" && { rating: item.rating }),
    };
  };

  const updateDisplayName = async (name: string) => {
    if (!profile) return;
    const updatedProfile = {
      ...profile,
      displayName: name.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    await saveProfileToFirebase(updatedProfile);
  };

  const updateProfilePicture = async (pictureId: string) => {
    if (!profile) return;
    const updatedProfile = {
      ...profile,
      profilePicture: pictureId,
      updatedAt: new Date().toISOString(),
    };
    await saveProfileToFirebase(updatedProfile);
  };

  const addToWatchlist = async (item: Omit<WatchlistItem, "dateAdded">) => {
    if (!profile) {
      return;
    }

    // Ensure watchlist exists and remove existing entry if it exists
    const currentWatchlist = Array.isArray(profile.watchlist)
      ? profile.watchlist
      : [];
    const filtered = currentWatchlist.filter((w) => w.slug !== item.slug);

    // Sanitize and add new entry
    const newItem = sanitizeWatchlistItem({
      ...item,
      dateAdded: new Date().toISOString(),
    });

    const updatedProfile = {
      ...profile,
      watchlist: [...filtered, newItem],
      updatedAt: new Date().toISOString(),
    };

    await saveProfileToFirebase(updatedProfile);
  };

  const updateWatchlistStatus = async (slug: string, status: WatchStatus) => {
    if (!profile) return;

    const currentWatchlist = Array.isArray(profile.watchlist)
      ? profile.watchlist
      : [];
    const updatedProfile = {
      ...profile,
      watchlist: currentWatchlist.map((item) =>
        item.slug === slug
          ? sanitizeWatchlistItem({ ...item, status })
          : sanitizeWatchlistItem(item)
      ),
      updatedAt: new Date().toISOString(),
    };

    await saveProfileToFirebase(updatedProfile);
  };

  const removeFromWatchlist = async (slug: string) => {
    if (!profile) return;

    const currentWatchlist = Array.isArray(profile.watchlist)
      ? profile.watchlist
      : [];
    const updatedProfile = {
      ...profile,
      watchlist: currentWatchlist.filter((item) => item.slug !== slug),
      updatedAt: new Date().toISOString(),
    };

    await saveProfileToFirebase(updatedProfile);
  };

  const rateItem = async (slug: string, rating: number) => {
    if (!profile) return;

    const currentWatchlist = Array.isArray(profile.watchlist)
      ? profile.watchlist
      : [];
    const updatedProfile = {
      ...profile,
      watchlist: currentWatchlist.map((item) =>
        item.slug === slug
          ? sanitizeWatchlistItem({ ...item, rating })
          : sanitizeWatchlistItem(item)
      ),
      updatedAt: new Date().toISOString(),
    };

    await saveProfileToFirebase(updatedProfile);
  };

  const updateTopRanking = async (ranking: TopRanking) => {
    if (!profile) return;

    // Remove existing ranking at this position
    const filtered = profile.topRankings.filter((r) => r.rank !== ranking.rank);

    const updatedProfile = {
      ...profile,
      topRankings: [...filtered, ranking].sort((a, b) => a.rank - b.rank),
      updatedAt: new Date().toISOString(),
    };

    await saveProfileToFirebase(updatedProfile);
  };

  const addToTopRanking = async (
    rank: number,
    slug: string,
    title: string,
    image?: string,
    rating: number = 10,
    isPublic: boolean = true
  ) => {
    if (!profile) return;

    const newRanking: TopRanking = {
      rank,
      slug,
      title,
      image,
      rating,
      isPublic,
    };

    // Remove existing ranking at this position
    const filtered = profile.topRankings.filter((r) => r.rank !== rank);

    const updatedProfile = {
      ...profile,
      topRankings: [...filtered, newRanking].sort((a, b) => a.rank - b.rank),
      updatedAt: new Date().toISOString(),
    };

    await saveProfileToFirebase(updatedProfile);
  };

  const removeFromTopRanking = async (rank: number) => {
    if (!profile) return;

    const updatedProfile = {
      ...profile,
      topRankings: profile.topRankings.filter((r) => r.rank !== rank),
      updatedAt: new Date().toISOString(),
    };

    await saveProfileToFirebase(updatedProfile);
  };

  const reorderTopRankings = async (fromRank: number, toRank: number) => {
    if (!profile || fromRank === toRank) return;

    const rankings = [...profile.topRankings];
    const fromItem = rankings.find((r) => r.rank === fromRank);
    const toItem = rankings.find((r) => r.rank === toRank);

    if (!fromItem) return;

    // Remove the items being moved
    const filtered = rankings.filter(
      (r) => r.rank !== fromRank && r.rank !== toRank
    );

    // Create new ranking items with swapped positions
    const newRankings = [...filtered];
    newRankings.push({ ...fromItem, rank: toRank });
    if (toItem) {
      newRankings.push({ ...toItem, rank: fromRank });
    }

    const updatedProfile = {
      ...profile,
      topRankings: newRankings.sort((a, b) => a.rank - b.rank),
      updatedAt: new Date().toISOString(),
    };

    await saveProfileToFirebase(updatedProfile);
  };

  const getWatchlistByStatus = (status: WatchStatus): WatchlistItem[] => {
    if (!profile || !profile.watchlist || !Array.isArray(profile.watchlist))
      return [];
    return profile.watchlist.filter((item) => item.status === status);
  };

  // Continue watching functions
  const addToContinueWatching = async (
    item: Omit<ContinueWatchingItem, "dateAdded">
  ) => {
    if (!profile) return;

    const currentContinueWatching = Array.isArray(profile.continueWatching)
      ? profile.continueWatching
      : [];
    const filtered = currentContinueWatching.filter(
      (w) => w.slug !== item.slug
    );

    const newItem: ContinueWatchingItem = {
      ...item,
      dateAdded: new Date().toISOString(),
    };

    const updatedProfile = {
      ...profile,
      continueWatching: [...filtered, newItem],
      updatedAt: new Date().toISOString(),
    };

    await saveProfileToFirebase(updatedProfile);
  };

  const updateContinueWatchingProgress = async (
    slug: string,
    episode: number,
    totalEpisodes?: number
  ) => {
    if (!profile) return;

    const currentContinueWatching = Array.isArray(profile.continueWatching)
      ? profile.continueWatching
      : [];

    const updatedProfile = {
      ...profile,
      continueWatching: currentContinueWatching.map((item) =>
        item.slug === slug
          ? {
              ...item,
              currentEpisode: episode,
              totalEpisodes: totalEpisodes || item.totalEpisodes || 0,
              lastWatched: new Date().toISOString(),
            }
          : item
      ),
      updatedAt: new Date().toISOString(),
    };

    await saveProfileToFirebase(updatedProfile);
  };

  const removeFromContinueWatching = async (slug: string) => {
    if (!profile) return;

    const currentContinueWatching = Array.isArray(profile.continueWatching)
      ? profile.continueWatching
      : [];
    const updatedProfile = {
      ...profile,
      continueWatching: currentContinueWatching.filter(
        (item) => item.slug !== slug
      ),
      updatedAt: new Date().toISOString(),
    };

    await saveProfileToFirebase(updatedProfile);
  };

  const getContinueWatching = (): ContinueWatchingItem[] => {
    if (
      !profile ||
      !profile.continueWatching ||
      !Array.isArray(profile.continueWatching)
    ) {
      return [];
    }

    return profile.continueWatching.sort((a, b) => {
      const dateA = new Date(a.lastWatched);
      const dateB = new Date(b.lastWatched);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const getDisplayName = (): string => {
    if (!user) return "";
    return profile?.displayName || user.email || "";
  };

  const value: ProfileContextType = {
    profile,
    updateDisplayName,
    updateProfilePicture,
    addToWatchlist,
    updateWatchlistStatus,
    removeFromWatchlist,
    rateItem,
    updateTopRanking,
    addToTopRanking,
    removeFromTopRanking,
    reorderTopRankings,
    getWatchlistByStatus,
    addToContinueWatching,
    updateContinueWatchingProgress,
    removeFromContinueWatching,
    getContinueWatching,
    getDisplayName,
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
