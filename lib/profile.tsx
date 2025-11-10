"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./auth";
import { database } from "./firebase";
import { ref, set, onValue, get } from "firebase/database";
import { updateProfile } from "firebase/auth";
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
  syncDisplayNameToAuth: () => Promise<void>;
  forceSyncDisplayNameToAuth: () => Promise<void>;
  checkSyncStatus: () => {
    inSync: boolean;
    dbName: string | null;
    authName: string | null;
  };
  refreshAuthUser: () => Promise<void>;
  checkDisplayNameAvailability: (name: string) => Promise<boolean>;
  canChangeDisplayName: () => boolean;
  getDaysUntilNextChange: () => number;
  searchUsersByDisplayName: (
    query: string
  ) => Promise<{ uid: string; displayName: string; profilePicture: string }[]>;
  searchUsers: (query: string) => Promise<
    {
      uid: string;
      displayName: string;
      profilePicture: string;
      watchlistCount: number;
      rankingsCount: number;
    }[]
  >;
  getAllUsers: () => Promise<
    {
      uid: string;
      displayName: string;
      profilePicture: string;
      watchlistCount: number;
      rankingsCount: number;
    }[]
  >;
  loadUserProfile: (uid: string) => Promise<UserProfile | null>;
  updateProfilePicture: (pictureId: string) => Promise<void>;
  updateUserPoints: (points: number) => Promise<void>;
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

  // Auto-sync display name to Firebase Auth when profile is loaded
  useEffect(() => {
    const autoSyncDisplayName = async () => {
      if (
        user &&
        profile?.displayName &&
        user.displayName !== profile.displayName
      ) {
        try {
          await updateProfile(user, {
            displayName: profile.displayName,
          });
        } catch (error) {
          // Don't throw the error as this is a background sync
          // Users can manually sync if needed
        }
      }
    };

    // Only attempt auto-sync if we have all required data
    if (user && profile?.displayName) {
      autoSyncDisplayName();
    }
  }, [user, profile?.displayName]);

  // Save profile to Firebase (also updates local state for immediate feedback)
  const saveProfileToFirebase = async (updatedProfile: UserProfile) => {
    if (!user?.uid) {
      throw new Error("User not authenticated");
    }

    try {
      setProfile(updatedProfile); // Update local state immediately
      const profileRef = ref(database, `profiles/${user.uid}`);
      await set(profileRef, updatedProfile);
    } catch (error) {
      console.error("Error saving profile to Firebase:", error);

      // Revert local state since save failed
      setProfile(profile);

      // Re-throw the error so calling function can handle it
      throw error;
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

  const checkDisplayNameAvailability = async (
    name: string
  ): Promise<boolean> => {
    if (!name.trim()) {
      return false;
    }

    const trimmedName = name.trim().toLowerCase();

    // Check if it's the same as current display name (case-insensitive)
    if (profile?.displayName?.toLowerCase() === trimmedName) {
      return true;
    }

    try {
      const usersRef = ref(database, "users");

      return new Promise((resolve, reject) => {
        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          reject(new Error("Timeout checking display name availability"));
        }, 10000); // 10 second timeout

        const unsubscribe = onValue(
          usersRef,
          (snapshot) => {
            clearTimeout(timeout);

            const users = snapshot.val();
            if (!users) {
              resolve(true);
              return;
            }

            // Check if any user has this display name (case-insensitive)
            const isAvailable = !Object.values(
              users as Record<string, UserProfile>
            ).some((userProfile) => {
              const userDisplayName = userProfile.displayName?.toLowerCase();
              return userDisplayName === trimmedName;
            });

            resolve(isAvailable);
          },
          {
            onlyOnce: true,
          }
        );

        // Store unsubscribe function to clear it on timeout if needed
        setTimeout(() => {
          if (timeout) {
            unsubscribe();
          }
        }, 10000);
      });
    } catch (error) {
      console.error("Error checking display name availability:", error);
      throw error;
    }
  };

  const canChangeDisplayName = (): boolean => {
    if (!profile?.displayNameLastChanged) return true;

    const lastChanged = new Date(profile.displayNameLastChanged);
    const now = new Date();
    const daysSinceLastChange = Math.floor(
      (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceLastChange >= 90;
  };

  const getDaysUntilNextChange = (): number => {
    if (!profile?.displayNameLastChanged) return 0;

    const lastChanged = new Date(profile.displayNameLastChanged);
    const now = new Date();
    const daysSinceLastChange = Math.floor(
      (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24)
    );

    return Math.max(0, 90 - daysSinceLastChange);
  };

  const searchUsersByDisplayName = async (
    query: string
  ): Promise<
    { uid: string; displayName: string; profilePicture: string }[]
  > => {
    if (!query.trim() || query.trim().length < 2) return [];

    const trimmedQuery = query.trim().toLowerCase();

    try {
      const usersRef = ref(database, "users");
      return new Promise((resolve) => {
        onValue(
          usersRef,
          (snapshot) => {
            const users = snapshot.val();
            if (!users) {
              resolve([]);
              return;
            }

            const matchingUsers = Object.entries(
              users as Record<string, UserProfile>
            )
              .filter(([uid, userProfile]) => {
                return (
                  userProfile.displayName &&
                  userProfile.displayName
                    .toLowerCase()
                    .includes(trimmedQuery) &&
                  uid !== user?.uid
                ); // Exclude current user
              })
              .map(([uid, userProfile]) => ({
                uid,
                displayName: userProfile.displayName!,
                profilePicture: userProfile.profilePicture,
              }))
              .slice(0, 10); // Limit to 10 results

            resolve(matchingUsers);
          },
          { onlyOnce: true }
        );
      });
    } catch (error) {
      console.error("Error searching users:", error);
      return [];
    }
  };

  const searchUsers = async (
    query: string
  ): Promise<
    {
      uid: string;
      displayName: string;
      profilePicture: string;
      watchlistCount: number;
      rankingsCount: number;
    }[]
  > => {
    if (!query.trim() || query.trim().length < 2) return [];

    const trimmedQuery = query.trim().toLowerCase();

    try {
      const profilesRef = ref(database, "profiles"); // Use "profiles" to match where data is saved
      const snapshot = await get(profilesRef);

      if (!snapshot.exists()) {
        return [];
      }

      const profiles = snapshot.val();

      const matchingUsers = Object.entries(
        profiles as Record<string, UserProfile>
      )
        .filter(([uid, userProfile]) => {
          // Skip current user
          if (uid === user?.uid) return false;

          // Search by UID (exact or partial match)
          if (uid.toLowerCase().includes(trimmedQuery)) return true;

          // Search by display name from database (partial match)
          if (
            userProfile.displayName &&
            userProfile.displayName.toLowerCase().includes(trimmedQuery)
          )
            return true;

          return false;
        })
        .map(([uid, userProfile]) => ({
          uid,
          displayName: userProfile.displayName || "Anonymous User",
          profilePicture: userProfile.profilePicture || "",
          watchlistCount: Array.isArray(userProfile.watchlist)
            ? userProfile.watchlist.length
            : 0,
          rankingsCount: Array.isArray(userProfile.topRankings)
            ? userProfile.topRankings.filter((r) => r.isPublic).length
            : 0,
        }))
        .sort((a, b) => {
          // Sort by relevance: exact display name matches first, then partial matches
          const aDisplayName = a.displayName.toLowerCase();
          const bDisplayName = b.displayName.toLowerCase();

          if (aDisplayName === trimmedQuery && bDisplayName !== trimmedQuery)
            return -1;
          if (bDisplayName === trimmedQuery && aDisplayName !== trimmedQuery)
            return 1;

          if (
            aDisplayName.startsWith(trimmedQuery) &&
            !bDisplayName.startsWith(trimmedQuery)
          )
            return -1;
          if (
            bDisplayName.startsWith(trimmedQuery) &&
            !aDisplayName.startsWith(trimmedQuery)
          )
            return 1;

          return aDisplayName.localeCompare(bDisplayName);
        })
        .slice(0, 20); // Limit to 20 results

      return matchingUsers;
    } catch (error) {
      console.error("Error searching users:", error);

      // If we get a permission error, try a more limited search approach
      if (
        error instanceof Error &&
        error.message.includes("Permission denied")
      ) {
        // Fallback: only return current user's info if they match the search
        if (user && user.uid.toLowerCase().includes(trimmedQuery)) {
          return [
            {
              uid: user.uid,
              displayName: user.displayName || "Anonymous User",
              profilePicture: "",
              watchlistCount: 0,
              rankingsCount: 0,
            },
          ];
        }
      }

      return [];
    }
  };

  // Get all users for leaderboard (no search filter)
  const getAllUsers = async (): Promise<
    {
      uid: string;
      displayName: string;
      profilePicture: string;
      watchlistCount: number;
      rankingsCount: number;
    }[]
  > => {
    try {
      const profilesRef = ref(database, "profiles");
      const snapshot = await get(profilesRef);

      if (!snapshot.exists()) {
        return [];
      }

      const profiles = snapshot.val();

      const allUsers = Object.entries(profiles as Record<string, UserProfile>)
        .filter(([uid, userProfile]) => {
          // Skip current user optionally (you can remove this if you want to include current user)
          // if (uid === user?.uid) return false;
          return true; // Include all users
        })
        .map(([uid, userProfile]) => ({
          uid,
          displayName: userProfile.displayName || "Anonymous User",
          profilePicture: userProfile.profilePicture || "",
          watchlistCount: Array.isArray(userProfile.watchlist)
            ? userProfile.watchlist.length
            : 0,
          rankingsCount: Array.isArray(userProfile.topRankings)
            ? userProfile.topRankings.filter((r) => r.isPublic).length
            : 0,
        }));

      return allUsers;
    } catch (error) {
      console.error("Error getting all users:", error);
      return [];
    }
  };

  // Load other user's profile
  const loadUserProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const profileRef = ref(database, `profiles/${uid}`);
      const snapshot = await get(profileRef);

      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.val();
      // Ensure profile has all required properties with defaults
      const normalizedProfile: UserProfile = {
        ...DEFAULT_PROFILE,
        ...data,
        watchlist: Array.isArray(data.watchlist) ? data.watchlist : [],
        continueWatching: Array.isArray(data.continueWatching)
          ? data.continueWatching
          : [],
        topRankings: Array.isArray(data.topRankings) ? data.topRankings : [],
      };

      return normalizedProfile;
    } catch (error) {
      console.error("Error loading user profile:", error);
      return null;
    }
  };

  const updateDisplayName = async (name: string) => {
    if (!profile) {
      console.error("No profile found when trying to update display name");
      return;
    }

    if (!user) {
      console.error(
        "No authenticated user found when trying to update display name"
      );
      throw new Error("User not authenticated");
    }

    const trimmedName = name.trim();

    // Check if user can change display name (90-day cooldown)
    // Skip this check for first-time users (no existing display name)
    if (profile.displayName && !canChangeDisplayName()) {
      const error = `You can change your display name again in ${getDaysUntilNextChange()} days.`;
      console.error("Cooldown error:", error);
      throw new Error(error);
    }

    // Check if display name is available (skip if it's the same as current name)
    if (trimmedName !== profile.displayName) {
      try {
        const isAvailable = await checkDisplayNameAvailability(trimmedName);
        if (!isAvailable) {
          const error =
            "This display name is already taken. Please choose another one.";
          console.error("Availability error:", error);
          throw new Error(error);
        }
      } catch (error) {
        console.error("Error during availability check:", error);
        // If availability check fails, allow the update to proceed with a warning
        console.warn(
          "Proceeding with display name update despite availability check failure"
        );
      }
    }

    const updatedProfile = {
      ...profile,
      displayName: trimmedName || undefined,
      displayNameLastChanged: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // Update Firebase Realtime Database first
      await saveProfileToFirebase(updatedProfile);

      // Try to update Firebase Authentication user profile
      // But don't fail the entire operation if this fails
      try {
        await updateProfile(user, {
          displayName: trimmedName || null,
        });
      } catch (authError) {
        console.warn(
          "Failed to update Firebase Auth profile (database update succeeded):",
          authError
        );
        // Log the specific auth error but don't throw it
        const error = authError as { code?: string; message?: string };
        if (error?.code === "auth/requires-recent-login") {
          console.warn(
            "Auth update requires recent login - user may need to re-authenticate"
          );
        } else if (error?.code === "auth/user-token-expired") {
          console.warn("Auth token expired - user may need to re-authenticate");
        } else if (error?.message?.includes("Permission denied")) {
          console.warn(
            "Auth permission denied - this might be due to browser security policies"
          );
        }
        // Don't throw here - the main operation (database update) succeeded
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      throw error;
    }
  };

  const syncDisplayNameToAuth = async () => {
    if (!user) {
      return;
    }

    if (!profile?.displayName) {
      return;
    }

    try {
      await updateProfile(user, {
        displayName: profile.displayName,
      });
    } catch (error) {
      console.error("Error syncing display name to Firebase Auth:", error);
      throw error;
    }
  };

  const forceSyncDisplayNameToAuth = async () => {
    if (!user) {
      throw new Error("No authenticated user");
    }

    try {
      // Get the current display name from the database
      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        const displayName = userData.displayName;

        if (displayName) {
          // Check if already synced
          if (user.displayName === displayName) {
            return; // No error, just return success
          }

          try {
            // Update Firebase Auth profile with more specific error handling
            await updateProfile(user, {
              displayName: displayName,
            });

            // Try to reload user, but don't fail if this causes COOP issues
            try {
              await user.reload();
            } catch (reloadError) {
              console.warn(
                "User reload failed (this might be due to COOP policy):",
                reloadError
              );
              // Don't throw here, the profile update might still have worked
            }

            // Try to refresh token, but don't fail if this causes issues
            try {
              await user.getIdToken(true);
            } catch (tokenError) {
              console.warn("Token refresh failed:", tokenError);
              // Don't throw here either
            }
          } catch (profileUpdateError) {
            console.error(
              "Failed to update Firebase Auth profile:",
              profileUpdateError
            );

            // Check if it's a specific permission error
            const error = profileUpdateError as {
              code?: string;
              message?: string;
            };
            if (error?.code === "auth/requires-recent-login") {
              throw new Error(
                "Please log out and log back in, then try again. Recent authentication required."
              );
            } else if (error?.code === "auth/user-token-expired") {
              throw new Error(
                "Your session has expired. Please log out and log back in."
              );
            } else if (error?.message?.includes("Permission denied")) {
              throw new Error(
                "Permission denied. Please try logging out and logging back in."
              );
            } else {
              throw new Error(
                `Profile update failed: ${error?.message || "Unknown error"}`
              );
            }
          }
        } else {
          console.warn("No display name found in database");
          throw new Error("No display name found in database");
        }
      } else {
        console.warn("User data not found in database");
        throw new Error("User data not found in database");
      }
    } catch (error) {
      console.error("Error in force sync:", error);
      throw error;
    }
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

  const updateUserPoints = async (points: number) => {
    if (!profile) return;
    const updatedProfile = {
      ...profile,
      points: points,
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

  const refreshAuthUser = async () => {
    if (!user) {
      throw new Error("No authenticated user");
    }

    try {
      await user.reload();
    } catch (error) {
      console.warn(
        "Failed to refresh auth user (might be due to COOP policy):",
        error
      );
      // Don't throw here as this is often not critical
    }
  };

  const checkSyncStatus = () => {
    const dbName = profile?.displayName || null;
    const authName = user?.displayName || null;
    const inSync = dbName === authName && dbName !== null;

    return {
      inSync,
      dbName,
      authName,
    };
  };

  const getDisplayName = (): string => {
    if (!user) return "";
    return profile?.displayName || user.email || "";
  };

  const value: ProfileContextType = {
    profile,
    updateDisplayName,
    syncDisplayNameToAuth,
    forceSyncDisplayNameToAuth,
    checkSyncStatus,
    refreshAuthUser,
    checkDisplayNameAvailability,
    canChangeDisplayName,
    getDaysUntilNextChange,
    searchUsersByDisplayName,
    searchUsers,
    getAllUsers,
    loadUserProfile,
    updateProfilePicture,
    updateUserPoints,
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
