"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_PROFILE, type ContinueWatchingItem, type UserProfile, type WatchlistItem, type WatchStatus } from "./types";
import { validateProfile } from './profile-transfer';

const STORAGE_KEY = "hanstream-local-profile";
type NewWatchlistItem = Omit<WatchlistItem, "dateAdded">;
type NewContinueItem = Omit<ContinueWatchingItem, "dateAdded">;

type ProfileContextValue = {
  replaceProfile: (profile: UserProfile) => void;
  clearProfile: () => void;
  setEpisodeWatched: (slug:string,episode:string,watched:boolean)=>Promise<void>;
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
      setProfile(stored ? validateProfile(JSON.parse(stored)) : { ...DEFAULT_PROFILE });
    } catch {
      setProfile({ ...DEFAULT_PROFILE });
    }
  }, []);

  const update = useCallback((change: (current: UserProfile) => UserProfile) => {
    setProfile((current) => {
      const next = { ...change(current || DEFAULT_PROFILE), updatedAt: new Date().toISOString() };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Retain session state when browser storage is unavailable. */ }
      return next;
    });
  }, []);
  const replaceProfile = useCallback((value: UserProfile) => {
    const next = { ...validateProfile(value), updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setProfile(next);
  }, []);
  const clearProfile = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProfile({ ...DEFAULT_PROFILE, watchedEpisodes: {}, watchlist: [], continueWatching: [], topRankings: [], createdAt: new Date().toISOString() });
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
  const setEpisodeWatched=useCallback(async(slug:string,episode:string,watched:boolean)=>update(current=>{
    const id=canonicalEpisode(episode);if(!id)return current;
    const history=current.watchedEpisodes && typeof current.watchedEpisodes==='object' ? current.watchedEpisodes : {};
    const episodes=Array.isArray(history[slug])?history[slug]:[];
    return {...current,watchedEpisodes:{...history,[slug]:watched?[...new Set([...episodes,id])]:episodes.filter(value=>value!==id)}};
  }),[update]);

  return <ProfileContext.Provider value={{ profile, replaceProfile, clearProfile, setEpisodeWatched, addToWatchlist, updateWatchlistStatus, removeFromWatchlist, rateItem, addToContinueWatching, updateContinueWatchingProgress, removeFromContinueWatching, getContinueWatching, getDisplayName }}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used within ProfileProvider");
  return context;
}

export function canonicalEpisode(value:string) {
  const match=/^(?:s(\d+)e)?(\d+(?:\.\d+)?)$/i.exec(value);
  return match && Number(match[2])>0 ? 's'+Number(match[1]||1)+'e'+Number(match[2]) : '';
}
export function useEpisodeHistory(slug:string) {
  const context=useContext(ProfileContext);
  const values=context?.profile?.watchedEpisodes?.[slug];
  return {watched:Array.isArray(values)?values:[],ready:Boolean(context?.profile),setWatched:(episode:string,watched:boolean)=>context?.setEpisodeWatched(slug,episode,watched)};
}
