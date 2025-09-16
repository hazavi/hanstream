// Profile and watchlist types

export type WatchStatus = 'watching' | 'paused' | 'plan-to-watch' | 'finished' | 'dropped';

export interface WatchlistItem {
  slug: string;
  title: string;
  image?: string;
  status: WatchStatus;
  progress?: {
    currentEpisode: number;
    totalEpisodes?: number;
    lastWatched: string; // ISO date string
  };
  rating?: number; // 1-10
  dateAdded: string; // ISO date string
}

export interface TopRanking {
  rank: number; // 1-10
  slug: string;
  title: string;
  image?: string;
  rating: number;
  isPublic: boolean; // whether to show on profile
}

export interface ContinueWatchingItem {
  slug: string;
  title: string;
  image?: string;
  currentEpisode: number;
  totalEpisodes?: number;
  lastWatched: string; // ISO date string
  dateAdded: string; // ISO date string
}

export interface UserProfile {
  displayName?: string;
  profilePicture: string; // template picture identifier
  watchlist: WatchlistItem[];
  continueWatching: ContinueWatchingItem[];
  topRankings: TopRanking[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

// Template profile pictures
export const PROFILE_TEMPLATES = [
  { id: 'avatar-1', name: 'Default', url: '/avatars/avatar-1.svg' },
  { id: 'avatar-2', name: 'K-Drama Fan', url: '/avatars/avatar-2.svg' },
  { id: 'avatar-3', name: 'Romantic', url: '/avatars/avatar-3.svg' },
  { id: 'avatar-4', name: 'Action', url: '/avatars/avatar-4.svg' },
  { id: 'avatar-5', name: 'Historical', url: '/avatars/avatar-5.svg' },
  { id: 'avatar-6', name: 'Modern', url: '/avatars/avatar-6.svg' },
] as const;

export type ProfileTemplateId = typeof PROFILE_TEMPLATES[number]['id'];

// Default profile
export const DEFAULT_PROFILE: UserProfile = {
  profilePicture: 'avatar-1',
  watchlist: [],
  continueWatching: [],
  topRankings: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};