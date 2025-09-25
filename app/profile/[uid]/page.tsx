"use client";

import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { PROFILE_TEMPLATES, WatchStatus } from "@/lib/types";
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
    updateProfilePicture,
    getWatchlistByStatus,
    addToTopRanking,
    removeFromTopRanking,
    reorderTopRankings,
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
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedDrama, setSelectedDrama] = useState<any>(null);
  const [tempRating, setTempRating] = useState(10);

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

    // If user is logged in and viewing their own profile, make sure URL matches their UID
    if (user && profileUid && user.uid !== profileUid) {
      // If trying to view someone else's profile, redirect to own profile for now
      router.push(`/profile/${user.uid}`);
    }
  }, [user, loading, router, profileUid]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchDramas(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, searchDramas]);

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

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <div className="animate-pulse">Loading profile...</div>
      </div>
    );
  }

  const handleNameEdit = () => {
    setTempName(profile.displayName || "");
    setEditingName(true);
  };

  const handleNameSave = async () => {
    await updateDisplayName(tempName);
    setEditingName(false);
  };

  const currentTemplate = PROFILE_TEMPLATES.find(
    (t) => t.id === profile.profilePicture
  );
  const watchlistItems = getWatchlistByStatus(activeTab);

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 overflow-hidden">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Profile Picture */}
          <div className="flex flex-col items-center space-y-3">
            <div
              className="relative cursor-pointer group"
              onClick={() =>
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
                    {(profile.displayName || user?.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
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
              </div>
            </div>

            {/* Profile Picture Templates */}
            {showProfilePicTemplates && (
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
                        profile.profilePicture === template.id ? "selected" : ""
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="Enter display name"
                    className="profile-name-input"
                  />
                  <button onClick={handleNameSave} className="btn-primary">
                    Save
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="profile-name">
                    {profile.displayName || user?.email}
                  </h1>
                  <button onClick={handleNameEdit} className="edit-btn">
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
                </div>
              )}
              {profile.displayName && (
                <p className="profile-email">{user?.email}</p>
              )}
            </div>

            <div className="profile-stats">
              <div className="stat-item">
                <div className="stat-number">
                  {Array.isArray(profile.watchlist)
                    ? profile.watchlist.length
                    : 0}
                </div>
                <div className="stat-label">Total Shows</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">
                  {profile.topRankings.filter((r) => r.isPublic).length}
                </div>
                <div className="stat-label">Public Rankings</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Watchlist Section */}
      <div className="watchlist-section">
        <h2 className="section-title">My Watchlist</h2>

        {/* Status Tabs */}
        <div className="status-tabs">
          {WATCH_STATUSES.map(({ status, label, color }) => {
            const count = getWatchlistByStatus(status).length;
            return (
              <button
                key={status}
                onClick={() => {
                  setActiveTab(status);
                  setCurrentPage(1);
                }}
                className={`status-tab ${activeTab === status ? "active" : ""}`}
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
                    <div className="watchlist-rating-badge">
                      <svg
                        className="w-3 h-3"
                        fill="#fbbf24"
                        stroke="none"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <span className="score">{item.rating}/10</span>
                    </div>
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
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`pagination-number ${
                            currentPage === page ? "active" : ""
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}
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
              Start adding shows to your{" "}
              {WATCH_STATUSES.find(
                (s) => s.status === activeTab
              )?.label.toLowerCase()}{" "}
              list!
            </p>
          </div>
        )}
      </div>

      {/* Top 10 Rankings */}
      <div className="rankings-section">
        <div className="rankings-header">
          <h2 className="section-title">Top K-Dramas</h2>
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
        </div>

        {/* Rankings Grid - 2 rows of 5 */}
        <div className="rankings-grid-container">
          {profile.topRankings
            .sort((a, b) => a.rank - b.rank)
            .map((ranking) => (
              <div
                key={ranking.rank}
                className={`ranking-item ${editingRanking ? "editable" : ""} ${
                  draggedItem === ranking.rank ? "dragging" : ""
                } ${dragOverItem === ranking.rank ? "drag-over" : ""}`}
                draggable={editingRanking}
                onDragStart={(e) => handleDragStart(e, ranking.rank)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(ranking.rank)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, ranking.rank)}
                onMouseDown={() => handleMouseDown(ranking.rank)}
                style={{ cursor: editingRanking ? "move" : "default" }}
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
                    disabled={editingRanking}
                  />
                  <div className="ranking-rating-overlay">
                    <svg
                      className="w-3 h-3"
                      fill="#fbbf24"
                      stroke="none"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="rating-score">{ranking.rating}/10</span>
                  </div>

                  {editingRanking && (
                    <button
                      onClick={async () =>
                        await removeFromTopRanking(ranking.rank)
                      }
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
                  )}
                </div>
              </div>
            ))}

          {/* Add new ranking slot - only show next available */}
          {editingRanking &&
            profile.topRankings.length < 10 &&
            (() => {
              const existingRanks = profile.topRankings
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
                <div key={`empty-${nextRank}`} className="ranking-item empty">
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

        {profile.topRankings.length === 0 && (
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
              Create your top K-drama rankings to share with others!
            </p>
            {!editingRanking && (
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
        {editingRanking && profile.topRankings.length === 10 && (
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
          <div className="search-modal" onClick={(e) => e.stopPropagation()}>
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
                    key={drama.id || drama.slug || drama.title || index}
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
          <div className="search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="search-modal-header">
              <h3 className="text-lg font-semibold">
                Rate & Add to Rank #{selectedSlot}
              </h3>
              <button
                onClick={() => setShowRatingModal(false)}
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
                      step="0.5"
                      value={tempRating}
                      onChange={(e) => setTempRating(Number(e.target.value))}
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
                      if (selectedSlot && selectedDrama) {
                        try {
                          await addToTopRanking(
                            selectedSlot,
                            selectedDrama["detail-link"] ||
                              selectedDrama.slug ||
                              "",
                            selectedDrama.title,
                            selectedDrama.image,
                            tempRating,
                            true // Always public
                          );
                        } catch (error) {
                          console.error("Error adding to ranking:", error);
                        }
                      }
                      setShowRatingModal(false);
                      setSelectedDrama(null);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="btn-primary flex-1"
                  >
                    Add to Rankings
                  </button>
                  <button
                    onClick={() => setShowRatingModal(false)}
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
    </div>
  );
}
