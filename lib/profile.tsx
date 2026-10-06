"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_PROFILE, type ContinueWatchingItem, type UserProfile, type WatchlistItem, type WatchStatus } from "./types";

const STORAGE_KEY = "hanstream-local-profile";
type NewWatchlistItem = Omit<WatchlistItem, "dateAdded">;
type NewContinueItem = Omit<ContinueWatchingItem, "dateAdded">;

type ProfileContextValue = {
  profile: UserProfile | null;
  addToWatchlist: (item: NewWatchlistItem) => Promise<void>;
  updateWatchlistStatus: (slug: string, status: WatchStatus) => Promise<void>;
  removeFromWatchlist: (slug: string) => Promise<void>;
  rateItem: (slug: string, rating: number) => Promise<void>;
  addToContinueWatching: (item: NewContinueItem) => Promise<void>;
  updateContinueWatchingProgress: (slug: string, episode: number, totalEpisodes?: number, episodeRoute?: string) => Promise<void>;
  removeFromContinueWatching: (slug: string) => Promise<void>;
  getContinueWatching: () => ContinueWatchingItem[];
  getDisplayName: () => string;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const data = stored ? JSON.parse(stored) as Partial<UserProfile> : {};
      setProfile({ ...DEFAULT_PROFILE, ...data, watchlist: Array.isArray(data.watchlist) ? data.watchlist : [], continueWatching: Array.isArray(data.continueWatching) ? data.continueWatching : [], topRankings: Array.isArray(data.topRankings) ? data.topRankings : [] });
    } catch {
      setProfile({ ...DEFAULT_PROFILE });
    }
  }, []);

  const update = useCallback((change: (current: UserProfile) => UserProfile) => {
    setProfile((current) => {
      const next = { ...change(current || DEFAULT_PROFILE), updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addToWatchlist = useCallback(async (item: NewWatchlistItem) => update((current) => ({ ...current, watchlist: [...current.watchlist.filter((existing) => existing.slug !== item.slug), { ...item, dateAdded: new Date().toISOString() }] })), [update]);
  const updateWatchlistStatus = useCallback(async (slug: string, status: WatchStatus) => update((current) => ({ ...current, watchlist: current.watchlist.map((item) => item.slug === slug ? { ...item, status } : item) })), [update]);
  const removeFromWatchlist = useCallback(async (slug: string) => update((current) => ({ ...current, watchlist: current.watchlist.filter((item) => item.slug !== slug) })), [update]);
  const rateItem = useCallback(async (slug: string, rating: number) => update((current) => ({ ...current, watchlist: current.watchlist.map((item) => item.slug === slug ? { ...item, rating } : item) })), [update]);
  const addToContinueWatching = useCallback(async (item: NewContinueItem) => update((current) => ({ ...current, continueWatching: [...current.continueWatching.filter((existing) => existing.slug !== item.slug), { ...item, dateAdded: new Date().toISOString() }] })), [update]);
  const updateContinueWatchingProgress = useCallback(async (slug: string, episode: number, totalEpisodes?: number, episodeRoute?: string) => update((current) => ({ ...current, continueWatching: current.continueWatching.map((item) => item.slug === slug ? { ...item, currentEpisode: episode, episodeRoute, totalEpisodes, lastWatched: new Date().toISOString() } : item) })), [update]);
  const removeFromContinueWatching = useCallback(async (slug: string) => update((current) => ({ ...current, continueWatching: current.continueWatching.filter((item) => item.slug !== slug) })), [update]);
  const getContinueWatching = useCallback(() => profile?.continueWatching || [], [profile]);
  const getDisplayName = useCallback(() => "My Library", []);

  return <ProfileContext.Provider value={{ profile, addToWatchlist, updateWatchlistStatus, removeFromWatchlist, rateItem, addToContinueWatching, updateContinueWatchingProgress, removeFromContinueWatching, getContinueWatching, getDisplayName }}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used within ProfileProvider");
  return context;
}
