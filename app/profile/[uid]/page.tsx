"use client";

import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import {
  PROFILE_TEMPLATES,
  WatchStatus,
  TopRanking,
  UserProfile,
} from "@/lib/types";
import { DramaCard } from "@/components/DramaCard";
import { PopularItem, fetchSearchClient } from "@/lib/api";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const WATCH_STATUSES: { status: WatchStatus; label: string; color: string }[] =
  [
    { status: "watching", label: "Watching", color: "text-green-500" },
    { status: "paused", label: "Paused", color: "text-yellow-500" },
    { status: "plan-to-watch", label: "Plan to Watch", color: "text-blue-500" },
    { status: "finished", label: "Finished", color: "text-purple-500" },
    { status: "dropped", label: "Dropped", color: "text-red-500" },
  ];

interface ProfilePageProps {
  params: Promise<{ uid: string }>;
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { user, loading } = useAuth();
  const {
    profile,
    updateDisplayName,
    syncDisplayNameToAuth,
    forceSyncDisplayNameToAuth,
    checkSyncStatus,
    refreshAuthUser,
    updateProfilePicture,
    getWatchlistByStatus,
    addToTopRanking,
    removeFromTopRanking,
    reorderTopRankings,
    rateItem,
    canChangeDisplayName,
    getDaysUntilNextChange,
    searchUsers,
    loadUserProfile,
  } = useProfile();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<WatchStatus>("watching");
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [editingRanking, setEditingRanking] = useState(false);
  const [showProfilePicTemplates, setShowProfilePicTemplates] = useState(false);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PopularItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedDrama, setSelectedDrama] = useState<PopularItem | null>(null);
  const [tempRating, setTempRating] = useState(10);
  const [editingRankingItem, setEditingRankingItem] = useState<number | null>(
    null
  );
  const [showWatchlistRatingModal, setShowWatchlistRatingModal] =
    useState(false);
  const [selectedWatchlistItem, setSelectedWatchlistItem] = useState<{
    slug: string;
    title: string;
    image?: string;
    rating?: number;
  } | null>(null);
  const [tempWatchlistRating, setTempWatchlistRating] = useState(10);
  const [nameChangeError, setNameChangeError] = useState<string>("");
  const [nameChangeSuccess, setNameChangeSuccess] = useState<string>("");

  // Tab states
  const [activeMainTab, setActiveMainTab] = useState<"profile" | "users">(
    "profile"
  );
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<
    {
      uid: string;
      displayName: string;
      profilePicture: string;
      watchlistCount: number;
      rankingsCount: number;
      fullProfile?: UserProfile | null;
    }[]
  >([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // State for viewing other users' profiles
  const [viewedUserProfile, setViewedUserProfile] =
    useState<UserProfile | null>(null);
  const [isViewingOtherUser, setIsViewingOtherUser] = useState(false);

  // State for managing open user tabs
  const [openUserTabs, setOpenUserTabs] = useState<
    {
      uid: string;
      displayName: string;
      profile: UserProfile;
    }[]
  >([]);
  const [activeUserTab, setActiveUserTab] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 10; // 2 rows of 5 items each

  // Search dramas for ranking
  const searchDramas = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await fetchSearchClient(query, 1);
      setSearchResults(data?.results?.slice(0, 10) || []);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Search users function
  const handleUserSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || query.length < 2) {
        setUserSearchResults([]);
        return;
      }

      setIsSearchingUsers(true);
      try {
        const results = await searchUsers(query);

        // Load full profile data for each user to get recent activity
        const resultsWithProfiles = await Promise.all(
          results.map(async (user) => {
            try {
              const fullProfile = await loadUserProfile(user.uid);
              return {
                ...user,
                fullProfile,
              };
            } catch (error) {
              console.error(`Error loading profile for ${user.uid}:`, error);
              return {
                ...user,
                fullProfile: null,
              };
            }
          })
        );

        setUserSearchResults(resultsWithProfiles);
      } catch (error) {
        console.error("User search error:", error);
        setUserSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    },
    [searchUsers, loadUserProfile]
  );

  // Function to open a user profile in a new tab
  const openUserTab = useCallback(
    async (uid: string, displayName: string) => {
      // Check if tab is already open
      const existingTab = openUserTabs.find((tab) => tab.uid === uid);
      if (existingTab) {
        setActiveUserTab(uid);
        return;
      }

      // Load the user's profile
      try {
        const userProfile = await loadUserProfile(uid);
        if (userProfile) {
          const newTab = {
            uid,
            displayName,
            profile: userProfile,
          };
          setOpenUserTabs((prev) => [...prev, newTab]);
          setActiveUserTab(uid);
        }
      } catch (error) {
        console.error("Error loading user profile:", error);
      }
    },
    [openUserTabs, loadUserProfile]
  );

  // Function to close a user tab
  const closeUserTab = useCallback(
    (uid: string) => {
      setOpenUserTabs((prev) => prev.filter((tab) => tab.uid !== uid));

      // If we're closing the active tab, switch to another tab or back to main profile
      if (activeUserTab === uid) {
        const remainingTabs = openUserTabs.filter((tab) => tab.uid !== uid);
        if (remainingTabs.length > 0) {
          setActiveUserTab(remainingTabs[remainingTabs.length - 1].uid);
        } else {
          setActiveUserTab(null);
          setActiveMainTab("profile");
        }
      }
    },
    [activeUserTab, openUserTabs]
  );

  // All useEffect hooks must come before any conditional returns
  useEffect(() => {
    params.then((resolved) => {
      setProfileUid(resolved.uid);
    });
  }, [params]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
  }, [user, loading, router]);

  // Load other user's profile if viewing someone else
  useEffect(() => {
    if (!profileUid || !user) return;

    const isOwnProfile = profileUid === user.uid;
    setIsViewingOtherUser(!isOwnProfile);

    if (!isOwnProfile) {
      // Load other user's profile
      loadUserProfile(profileUid).then((otherProfile) => {
        setViewedUserProfile(otherProfile);
      });
    } else {
      setViewedUserProfile(null);
    }
  }, [profileUid, user, loadUserProfile]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchDramas(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, searchDramas]);

  // Debounce user search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleUserSearch(userSearchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [userSearchQuery, handleUserSearch]);

  // Early returns after all hooks
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user || !profileUid) {
    return null; // Will redirect via useEffect
  }

  // Determine which profile to display
  const getDisplayProfile = () => {
    if (activeUserTab) {
      const activeTab = openUserTabs.find((tab) => tab.uid === activeUserTab);
      return activeTab?.profile || null;
    }
    return isViewingOtherUser ? viewedUserProfile : profile;
  };

  const displayProfile = getDisplayProfile();
  const isOwnProfile = !isViewingOtherUser && !activeUserTab;
  const currentDisplayName = activeUserTab
    ? openUserTabs.find((tab) => tab.uid === activeUserTab)?.displayName ||
      "User"
    : isViewingOtherUser
    ? viewedUserProfile?.displayName || "User"
    : profile?.displayName || user?.email || "My Profile";

  if (!displayProfile) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <div className="animate-pulse">
          {isViewingOtherUser
            ? "Loading user profile..."
            : "Loading profile..."}
        </div>
      </div>
    );
  }

  const handleNameEdit = () => {
    if (!isOwnProfile) return; // Can't edit other users' names

    setNameChangeError("");
    setNameChangeSuccess("");

    // Check if user can change display name and show warning if not
    if (displayProfile?.displayName && !canChangeDisplayName()) {
      const daysLeft = getDaysUntilNextChange();
      setNameChangeError(
        `You can change your display name again in ${daysLeft} days.`
      );
      return;
    }

    setTempName(displayProfile?.displayName || "");
    setEditingName(true);
  };

  const handleNameSave = async () => {
    try {
      console.log("Starting display name save process...");
      setNameChangeError("");
      setNameChangeSuccess("");

      if (!tempName.trim()) {
        setNameChangeError("Display name cannot be empty");
        return;
      }

      console.log("Calling updateDisplayName with:", tempName);
      await updateDisplayName(tempName);

      console.log("Display name updated successfully");
      setEditingName(false);
      setNameChangeSuccess("Display name updated and synced to your account!");

      // Clear success message after 3 seconds
      setTimeout(() => setNameChangeSuccess(""), 3000);
    } catch (error) {
      console.error("Error in handleNameSave:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update display name";
      setNameChangeError(errorMessage);
    }
  };

  const currentTemplate = PROFILE_TEMPLATES.find(
    (t) => t.id === displayProfile?.profilePicture
  );
  const watchlistItems = isOwnProfile
    ? getWatchlistByStatus(activeTab).sort((a, b) => {
        // Sort by dateAdded timestamp in descending order (newest first)
        const aTime = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const bTime = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        return bTime - aTime;
      })
    : (displayProfile?.watchlist || [])
        .filter((item) => item.status === activeTab)
        .sort((a, b) => {
          // Sort by dateAdded timestamp in descending order (newest first)
          const aTime = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
          const bTime = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
          return bTime - aTime;
        });

  // Pagination logic
  const totalPages = Math.ceil(watchlistItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = watchlistItems.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, rank: number) => {
    console.log("Drag started for rank:", rank);
    console.log("Edit mode:", editingRanking);
    console.log("Target element:", e.currentTarget);

    if (!editingRanking) {
      console.log("Not in edit mode, preventing drag");
      e.preventDefault();
      return;
    }

    setDraggedItem(rank);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", rank.toString());

    // Make sure we're dragging the right element
    const dragElement = e.currentTarget as HTMLElement;
    dragElement.style.opacity = "0.5";
    dragElement.style.transform = "rotate(2deg) scale(1.05)";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (targetRank: number) => {
    if (draggedItem && draggedItem !== targetRank) {
      setDragOverItem(targetRank);
    }
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = async (e: React.DragEvent, targetRank: number) => {
    e.preventDefault();
    const sourceRank = parseInt(e.dataTransfer.getData("text/plain"));
    if (sourceRank && sourceRank !== targetRank) {
      try {
        await reorderTopRankings(sourceRank, targetRank);
      } catch (error) {
        console.error("Error reordering rankings:", error);
      }
    }
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const dragElement = e.currentTarget as HTMLElement;
    dragElement.style.opacity = "1";
    dragElement.style.transform = "";
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleMouseDown = (rank: number) => {
    console.log("Mouse down on rank:", rank, "Edit mode:", editingRanking);
  };

  const handleEditRanking = (ranking: TopRanking) => {
    setSelectedDrama({
      "detail-link": ranking.slug,
      title: ranking.title,
      image: ranking.image || "",
    } as PopularItem);
    setTempRating(ranking.rating || 10);
    setEditingRankingItem(ranking.rank);
    setShowRatingModal(true);
  };

  const handleEditWatchlistRating = (item: {
    slug: string;
    title: string;
    image?: string;
    rating?: number;
  }) => {
    setSelectedWatchlistItem(item);
    setTempWatchlistRating(item.rating || 10);
    setShowWatchlistRatingModal(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 overflow-hidden">
      {/* Main Navigation Tabs */}
      <div className="main-tabs-container">
        <div className="main-tabs">
          {/* My Profile Tab - always visible for own profile */}
          {!isViewingOtherUser && (
            <button
              onClick={() => {
                setActiveMainTab("profile");
                setActiveUserTab(null);
              }}
              className={`main-tab ${
                activeMainTab === "profile" && !activeUserTab ? "active" : ""
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              My Profile
            </button>
          )}

          {/* Users Tab - only show for own profile when not viewing other users */}
          {!isViewingOtherUser && (
            <button
              onClick={() => {
                setActiveMainTab("users");
                setActiveUserTab(null);
              }}
              className={`main-tab ${
                activeMainTab === "users" && !activeUserTab ? "active" : ""
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Discover Users
            </button>
          )}

          {/* User Profile Tabs - opened profiles at the same level */}
          {openUserTabs.map((userTab) => (
            <div
              key={userTab.uid}
              className={`main-tab ${
                activeUserTab === userTab.uid ? "active" : ""
              }`}
            >
              <button
                onClick={() => setActiveUserTab(userTab.uid)}
                className="tab-content-button"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                {userTab.displayName}
              </button>
              <button
                onClick={() => closeUserTab(userTab.uid)}
                className="close-tab-button"
                title="Close tab"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeMainTab === "profile" || activeUserTab ? (
        <>
          {/* Profile Header */}
          <div className="profile-header">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Profile Picture */}
              <div className="flex flex-col items-center space-y-3">
                <div
                  className={`relative group ${
                    isOwnProfile ? "cursor-pointer" : "cursor-default"
                  }`}
                  onClick={() =>
                    isOwnProfile &&
                    setShowProfilePicTemplates(!showProfilePicTemplates)
                  }
                >
                  <div className="profile-avatar">
                    {currentTemplate ? (
                      <Image
                        src={currentTemplate.url}
                        alt={currentTemplate.name}
                        width={96}
                        height={96}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl text-white font-semibold">
                        {(
                          displayProfile?.displayName ||
                          currentDisplayName ||
                          "U"
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    )}
                    {isOwnProfile && (
                      <div className="profile-avatar-overlay">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Picture Templates */}
                {showProfilePicTemplates && isOwnProfile && (
                  <div className="avatar-selector">
                    <h3 className="text-sm font-medium text-center mb-3">
                      Choose Avatar
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {PROFILE_TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          onClick={async () => {
                            await updateProfilePicture(template.id);
                            setShowProfilePicTemplates(false);
                          }}
                          className={`avatar-option ${
                            displayProfile?.profilePicture === template.id
                              ? "selected"
                              : ""
                          }`}
                        >
                          <Image
                            src={template.url}
                            alt={template.name}
                            width={40}
                            height={40}
                            className="w-full h-full rounded-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 space-y-4">
                <div>
                  {editingName ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          placeholder="Enter display name"
                          className="profile-name-input"
                        />
                        <button
                          onClick={handleNameSave}
                          className="btn-primary"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingName(false);
                            setNameChangeError("");
                          }}
                          className="btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                      {nameChangeError && (
                        <div className="text-sm text-red-500 mt-1">
                          {nameChangeError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h1 className="profile-name">
                          {displayProfile?.displayName || currentDisplayName}
                        </h1>
                        {isOwnProfile && (
                          <button
                            onClick={handleNameEdit}
                            className={`edit-btn ${
                              displayProfile?.displayName &&
                              !canChangeDisplayName()
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                            disabled={
                              !!(
                                displayProfile?.displayName &&
                                !canChangeDisplayName()
                              )
                            }
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                      {nameChangeError && (
                        <div className="text-sm text-red-500">
                          {nameChangeError}
                        </div>
                      )}
                      {nameChangeSuccess && (
                        <div className="text-sm text-green-500">
                          {nameChangeSuccess}
                        </div>
                      )}
                      {displayProfile?.displayName &&
                        !canChangeDisplayName() &&
                        !nameChangeError &&
                        isOwnProfile && (
                          <div className="text-sm text-yellow-600">
                            You can change your display name again in{" "}
                            {getDaysUntilNextChange()} days.
                          </div>
                        )}
                    </div>
                  )}
                  {displayProfile?.displayName && isOwnProfile && (
                    <p className="profile-email">{user?.email}</p>
                  )}
                </div>

                {/* Display name sync notification - only for own profile */}
                {isOwnProfile &&
                  (() => {
                    const syncStatus = checkSyncStatus();
                    if (!syncStatus.inSync && syncStatus.dbName) {
                      return (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <svg
                              className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
                              />
                            </svg>
                            <div className="flex-1">
                              <p className="text-sm text-yellow-800">
                                Your display name isn't fully synced across all
                                services. This might affect how others find you.
                              </p>
                              <button
                                onClick={async () => {
                                  try {
                                    await forceSyncDisplayNameToAuth();
                                    alert(
                                      "Sync completed successfully! Your display name is now searchable by other users."
                                    );
                                  } catch (error) {
                                    const errorMessage =
                                      error instanceof Error
                                        ? error.message
                                        : "Unknown error";
                                    if (
                                      errorMessage.includes(
                                        "Permission denied"
                                      ) ||
                                      errorMessage.includes(
                                        "recent authentication"
                                      )
                                    ) {
                                      alert(
                                        "Please log out and log back in, then try syncing again."
                                      );
                                    } else if (
                                      errorMessage.includes(
                                        "No display name in database"
                                      )
                                    ) {
                                      alert(
                                        "Please set a display name first before syncing."
                                      );
                                    } else {
                                      alert(`Sync failed: ${errorMessage}`);
                                    }
                                  }
                                }}
                                className="mt-2 text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 transition-colors"
                              >
                                Sync Display Name
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                <div className="profile-stats">
                  <div className="stat-item">
                    <div className="stat-number">
                      {Array.isArray(displayProfile?.watchlist)
                        ? displayProfile.watchlist.length
                        : 0}
                    </div>
                    <div className="stat-label">Total Shows</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">
                      {
                        (displayProfile?.topRankings || []).filter(
                          (r) => r.isPublic
                        ).length
                      }
                    </div>
                    <div className="stat-label">Public Rankings</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Watchlist Section */}
          <div className="watchlist-section">
            <h2 className="section-title">
              {isOwnProfile
                ? "My Watchlist"
                : `${currentDisplayName}'s Watchlist`}
            </h2>

            {/* Status Tabs */}
            <div className="status-tabs">
              {WATCH_STATUSES.map(({ status, label, color }) => {
                const count = isOwnProfile
                  ? getWatchlistByStatus(status).length
                  : (displayProfile?.watchlist || []).filter(
                      (item) => item.status === status
                    ).length;
                return (
                  <button
                    key={status}
                    onClick={() => {
                      setActiveTab(status);
                      setCurrentPage(1);
                    }}
                    className={`status-tab ${
                      activeTab === status ? "active" : ""
                    }`}
                  >
                    <span className={count > 0 ? color : "text-secondary"}>
                      {label} ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Watchlist Grid */}
            {watchlistItems.length > 0 ? (
              <div className="space-y-6">
                <div className="watchlist-grid">
                  {paginatedItems.map((item) => (
                    <div key={item.slug} className="watchlist-item">
                      <DramaCard
                        item={
                          {
                            "detail-link": item.slug,
                            title: item.title,
                            image: item.image || "",
                          } as PopularItem
                        }
                        variant="popular"
                      />
                      {item.progress && (
                        <div className="progress-overlay">
                          Episode {item.progress.currentEpisode}
                          {item.progress.totalEpisodes &&
                            ` / ${item.progress.totalEpisodes}`}
                        </div>
                      )}
                      {item.rating && (
                        <button
                          onClick={() =>
                            isOwnProfile &&
                            handleEditWatchlistRating({
                              slug: item.slug,
                              title: item.title,
                              image: item.image,
                              rating: item.rating,
                            })
                          }
                          className={`watchlist-rating-badge ${
                            isOwnProfile ? "clickable" : ""
                          }`}
                          disabled={!isOwnProfile}
                        >
                          <svg
                            className="w-3 h-3"
                            fill="#fbbf24"
                            stroke="none"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <span className="score">{item.rating}/10</span>
                        </button>
                      )}
                      {item.status === "finished" &&
                        !item.rating &&
                        isOwnProfile && (
                          <button
                            onClick={() =>
                              handleEditWatchlistRating({
                                slug: item.slug,
                                title: item.title,
                                image: item.image,
                                rating: undefined,
                              })
                            }
                            className="add-rating-button"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                              />
                            </svg>
                            <span className="text">Add Rating</span>
                          </button>
                        )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pagination-container">
                    <div className="pagination-wrapper">
                      {/* Previous Button */}
                      <button
                        onClick={() =>
                          setCurrentPage(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage === 1}
                        className="pagination-nav prev"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                          />
                        </svg>
                        Previous
                      </button>

                      {/* Page Numbers */}
                      <div className="pagination-numbers">
                        {Array.from(
                          { length: totalPages },
                          (_, i) => i + 1
                        ).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`pagination-number ${
                              currentPage === page ? "active" : ""
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      {/* Next Button */}
                      <button
                        onClick={() =>
                          setCurrentPage(Math.min(totalPages, currentPage + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="pagination-nav next"
                      >
                        Next
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <h3 className="empty-title">No shows yet</h3>
                <p className="empty-subtitle">
                  {isOwnProfile
                    ? `Start adding shows to your ${WATCH_STATUSES.find(
                        (s) => s.status === activeTab
                      )?.label.toLowerCase()} list!`
                    : `${
                        displayProfile.displayName || "This user"
                      } hasn't added any shows to their ${WATCH_STATUSES.find(
                        (s) => s.status === activeTab
                      )?.label.toLowerCase()} list yet.`}
                </p>
              </div>
            )}
          </div>

          {/* Top 10 Rankings */}
          <div className="rankings-section">
            <div className="rankings-header">
              <h2 className="section-title">Top K-Dramas</h2>
              {isOwnProfile && (
                <div className="rankings-actions">
                  <button
                    onClick={() => setEditingRanking(!editingRanking)}
                    className="edit-rankings-btn"
                  >
                    {editingRanking ? (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Done
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                        Edit
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Rankings Grid - 2 rows of 5 */}
            <div className="rankings-grid-container">
              {(displayProfile?.topRankings || [])
                .sort((a, b) => a.rank - b.rank)
                .map((ranking) => (
                  <div
                    key={ranking.rank}
                    className={`ranking-item ${
                      editingRanking && isOwnProfile ? "editable" : ""
                    } ${draggedItem === ranking.rank ? "dragging" : ""} ${
                      dragOverItem === ranking.rank ? "drag-over" : ""
                    }`}
                    draggable={editingRanking && isOwnProfile}
                    onDragStart={(e) =>
                      isOwnProfile && handleDragStart(e, ranking.rank)
                    }
                    onDragEnd={isOwnProfile ? handleDragEnd : undefined}
                    onDragOver={isOwnProfile ? handleDragOver : undefined}
                    onDragEnter={() =>
                      isOwnProfile && handleDragEnter(ranking.rank)
                    }
                    onDragLeave={isOwnProfile ? handleDragLeave : undefined}
                    onDrop={(e) => isOwnProfile && handleDrop(e, ranking.rank)}
                    onMouseDown={() =>
                      isOwnProfile && handleMouseDown(ranking.rank)
                    }
                    style={{
                      cursor:
                        editingRanking && isOwnProfile ? "move" : "default",
                    }}
                  >
                    <div className="ranking-card-container">
                      <div className="ranking-number">
                        <span className="rank-text">{ranking.rank}</span>
                      </div>
                      {editingRanking && (
                        <div className="drag-handle">
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm8-12a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </div>
                      )}

                      <DramaCard
                        item={
                          {
                            "detail-link": ranking.slug,
                            title: ranking.title,
                            image: ranking.image || "",
                          } as PopularItem
                        }
                        variant="popular"
                      />
                      <div className="ranking-title">{ranking.title}</div>
                      <div className="ranking-rating-overlay">
                        <svg
                          className="w-3 h-3"
                          fill="#fbbf24"
                          stroke="none"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <span className="rating-score">
                          {ranking.rating}/10
                        </span>
                      </div>

                      {editingRanking && isOwnProfile && (
                        <>
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              await removeFromTopRanking(ranking.rank);
                            }}
                            className="remove-ranking-button"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEditRanking(ranking);
                            }}
                            className="edit-rating-button"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}

              {/* Add new ranking slot - only show next available */}
              {editingRanking &&
                isOwnProfile &&
                (displayProfile?.topRankings || []).length < 10 &&
                (() => {
                  const existingRanks = (displayProfile?.topRankings || [])
                    .map((r) => r.rank)
                    .sort((a, b) => a - b);
                  let nextRank = 1;
                  for (let rank = 1; rank <= 10; rank++) {
                    if (!existingRanks.includes(rank)) {
                      nextRank = rank;
                      break;
                    }
                  }
                  return (
                    <div
                      key={`empty-${nextRank}`}
                      className="ranking-item empty"
                    >
                      <div className="ranking-card-container empty">
                        <div className="ranking-number">
                          <span className="rank-text">{nextRank}</span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedSlot(nextRank);
                            setShowSearchModal(true);
                          }}
                          className="add-ranking-placeholder"
                        >
                          <svg
                            className="w-8 h-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          <span>Add Drama</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
            </div>

            {(displayProfile?.topRankings || []).length === 0 && (
              <div className="empty-rankings">
                <div className="empty-rankings-icon">
                  <svg
                    className="w-12 h-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                    />
                  </svg>
                </div>
                <h3 className="empty-rankings-title">No rankings yet</h3>
                <p className="empty-rankings-subtitle">
                  {isOwnProfile
                    ? "Create your top K-drama rankings to share with others!"
                    : `${currentDisplayName} hasn't created any rankings yet.`}
                </p>
                {!editingRanking && isOwnProfile && (
                  <button
                    onClick={() => setEditingRanking(true)}
                    className="start-ranking-btn"
                  >
                    Start Ranking
                  </button>
                )}
              </div>
            )}

            {/* Max limit reached message */}
            {editingRanking &&
              isOwnProfile &&
              (displayProfile?.topRankings || []).length === 10 && (
                <div className="max-rankings-message">
                  <svg
                    className="w-5 h-5 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>
                    Maximum 10 dramas reached. Remove a drama to add another.
                  </span>
                </div>
              )}
          </div>

          {/* Search Modal for Adding Dramas */}
          {showSearchModal && (
            <div
              className="search-modal-overlay"
              onClick={() => setShowSearchModal(false)}
            >
              <div
                className="search-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="search-modal-header">
                  <h3 className="text-lg font-semibold">
                    Add Drama to Rank #{selectedSlot}
                  </h3>
                  <button
                    onClick={() => setShowSearchModal(false)}
                    className="close-btn"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="search-modal-body">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for a drama..."
                    className="search-modal-input"
                    autoFocus
                  />

                  {isSearching && (
                    <div className="search-loading">
                      <svg
                        className="animate-spin w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Searching...
                    </div>
                  )}

                  <div className="search-results">
                    {searchResults.map((drama, index) => (
                      <button
                        key={drama["detail-link"] || drama.title || index}
                        onClick={() => {
                          setSelectedDrama(drama);
                          setShowSearchModal(false);
                          setShowRatingModal(true);
                          setTempRating(10);
                        }}
                        className="search-result-item"
                      >
                        <div className="search-result-image">
                          {drama.image && (
                            <Image
                              src={drama.image}
                              alt={drama.title}
                              width={40}
                              height={56}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="search-result-info">
                          <h4 className="search-result-title">{drama.title}</h4>
                          <p className="search-result-meta">Drama</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rating Modal */}
          {showRatingModal && selectedDrama && selectedSlot && (
            <div
              className="search-modal-overlay"
              onClick={() => setShowRatingModal(false)}
            >
              <div
                className="search-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="search-modal-header">
                  <h3 className="text-lg font-semibold">
                    {editingRankingItem
                      ? `Edit Rank #${editingRankingItem}`
                      : `Rate & Add to Rank #${selectedSlot}`}
                  </h3>
                  <button
                    onClick={() => {
                      setShowRatingModal(false);
                      setEditingRankingItem(null);
                      setSelectedDrama(null);
                    }}
                    className="close-btn"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="search-modal-body">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="search-result-image">
                      {selectedDrama.image && (
                        <Image
                          src={selectedDrama.image}
                          alt={selectedDrama.title}
                          width={48}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-foreground">
                        {selectedDrama.title}
                      </h4>
                      <p className="text-sm text-secondary">Drama</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Your Rating (1-10)
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="1"
                          max="10"
                          step="0.1"
                          value={tempRating}
                          onChange={(e) =>
                            setTempRating(Number(e.target.value))
                          }
                          className="flex-1 rating-slider"
                        />
                        <div className="rating-display">
                          <svg
                            className="w-4 h-4"
                            fill="#fbbf24"
                            stroke="none"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <span className="score">{tempRating}/10</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button
                        onClick={async () => {
                          if (selectedDrama) {
                            try {
                              const targetSlot =
                                editingRankingItem || selectedSlot;
                              if (targetSlot) {
                                await addToTopRanking(
                                  targetSlot,
                                  selectedDrama["detail-link"] ||
                                    selectedDrama["detail-link"] ||
                                    "",
                                  selectedDrama.title,
                                  selectedDrama.image,
                                  tempRating,
                                  true // Always public
                                );
                              }
                            } catch (error) {
                              console.error("Error updating ranking:", error);
                            }
                          }
                          setShowRatingModal(false);
                          setSelectedDrama(null);
                          setEditingRankingItem(null);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                        className="btn-primary flex-1"
                      >
                        {editingRankingItem
                          ? "Update Ranking"
                          : "Add to Rankings"}
                      </button>
                      <button
                        onClick={() => {
                          setShowRatingModal(false);
                          setEditingRankingItem(null);
                          setSelectedDrama(null);
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Watchlist Rating Modal */}
          {showWatchlistRatingModal && selectedWatchlistItem && (
            <div
              className="search-modal-overlay"
              onClick={() => setShowWatchlistRatingModal(false)}
            >
              <div
                className="search-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="search-modal-header">
                  <h3 className="text-lg font-semibold">
                    {selectedWatchlistItem.rating
                      ? "Edit Rating"
                      : "Add Rating"}
                  </h3>
                  <button
                    onClick={() => {
                      setShowWatchlistRatingModal(false);
                      setSelectedWatchlistItem(null);
                    }}
                    className="close-btn"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="search-modal-body">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="search-result-image">
                      {selectedWatchlistItem.image && (
                        <Image
                          src={selectedWatchlistItem.image}
                          alt={selectedWatchlistItem.title}
                          width={48}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-foreground">
                        {selectedWatchlistItem.title}
                      </h4>
                      <p className="text-sm text-secondary">Drama</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Your Rating (1-10)
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="1"
                          max="10"
                          step="0.1"
                          value={tempWatchlistRating}
                          onChange={(e) =>
                            setTempWatchlistRating(Number(e.target.value))
                          }
                          className="flex-1 rating-slider"
                        />
                        <div className="rating-display">
                          <svg
                            className="w-4 h-4"
                            fill="#fbbf24"
                            stroke="none"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <span className="score">
                            {tempWatchlistRating}/10
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button
                        onClick={async () => {
                          if (selectedWatchlistItem) {
                            try {
                              await rateItem(
                                selectedWatchlistItem.slug,
                                tempWatchlistRating
                              );
                            } catch (error) {
                              console.error("Error updating rating:", error);
                            }
                          }
                          setShowWatchlistRatingModal(false);
                          setSelectedWatchlistItem(null);
                        }}
                        className="btn-primary flex-1"
                      >
                        {selectedWatchlistItem.rating
                          ? "Update Rating"
                          : "Add Rating"}
                      </button>
                      <button
                        onClick={() => {
                          setShowWatchlistRatingModal(false);
                          setSelectedWatchlistItem(null);
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Users Tab Content */
        <div className="users-tab-content">
          {/* User Search Section */}
          <div className="users-search-section">
            <h2 className="section-title">Discover Users</h2>
            <div className="users-search-container">
              <div className="relative">
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search by display name or user ID..."
                  className="users-search-input"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Search Results */}
          <div className="users-search-results">
            {isSearchingUsers && (
              <div className="search-loading">
                <svg
                  className="animate-spin w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Searching users...
              </div>
            )}

            {userSearchQuery.trim() &&
              !isSearchingUsers &&
              userSearchResults.length === 0 && (
                <div className="empty-search-state">
                  <div className="empty-icon">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="empty-title">No users found</h3>
                  <p className="empty-subtitle">
                    Try searching with a different display name or user ID
                  </p>
                </div>
              )}

            {!userSearchQuery.trim() && (
              <div className="empty-search-state">
                <div className="empty-icon">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <h3 className="empty-title">Discover Users</h3>
                <p className="empty-subtitle">
                  Search for other users by their display name or user ID to
                  view their profiles
                </p>
              </div>
            )}

            {/* User search results */}
            <div className="user-results-grid">
              {userSearchResults.map((searchUser, index) => {
                const userTemplate = PROFILE_TEMPLATES.find(
                  (t) => t.id === searchUser.profilePicture
                );

                // Get recent activity from the user's profile
                const recentActivity = searchUser.fullProfile?.watchlist
                  ? searchUser.fullProfile.watchlist
                      .sort((a, b) => {
                        const aTime = a.dateAdded
                          ? new Date(a.dateAdded).getTime()
                          : 0;
                        const bTime = b.dateAdded
                          ? new Date(b.dateAdded).getTime()
                          : 0;
                        return bTime - aTime;
                      })
                      .slice(0, 3)
                  : [];

                return (
                  <div
                    key={searchUser.uid || index}
                    className="user-result-card"
                  >
                    <div className="user-result-header">
                      <div className="user-result-avatar">
                        {userTemplate ? (
                          <Image
                            src={userTemplate.url}
                            alt={searchUser.displayName}
                            width={56}
                            height={56}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-semibold">
                            {searchUser.displayName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="user-result-info">
                        <h4 className="user-result-name">
                          {searchUser.displayName}
                        </h4>
                        <p className="user-result-stats">
                          {searchUser.watchlistCount} shows •{" "}
                          {searchUser.rankingsCount} rankings
                        </p>
                      </div>
                      <div className="user-result-actions">
                        <button
                          onClick={() =>
                            openUserTab(searchUser.uid, searchUser.displayName)
                          }
                          className="view-profile-btn"
                        >
                          View Profile
                        </button>
                      </div>
                    </div>

                    {/* Recent Activity Preview */}
                    <div className="user-result-preview">
                      <div className="preview-section">
                        <span className="preview-label">Recent Activity</span>
                        <div className="preview-items">
                          {recentActivity.length > 0 ? (
                            recentActivity.map((item, itemIndex) => (
                              <div
                                key={item.slug || itemIndex}
                                className="preview-item"
                              >
                                {item.image && (
                                  <Image
                                    src={item.image}
                                    alt={item.title}
                                    width={32}
                                    height={44}
                                    className="preview-item-image"
                                  />
                                )}
                              </div>
                            ))
                          ) : (
                            <span className="preview-empty">
                              No recent activity
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
