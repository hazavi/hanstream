"use client";

import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { PROFILE_TEMPLATES, WatchStatus } from "@/lib/types";
import { DramaCard } from "@/components/DramaCard";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
    updateTopRanking,
    removeFromTopRanking,
  } = useProfile();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<WatchStatus>("watching");
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [editingRanking, setEditingRanking] = useState(false);
  const [showProfilePicTemplates, setShowProfilePicTemplates] = useState(false);
  const [profileUid, setProfileUid] = useState<string | null>(null);

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

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Profile Picture */}
          <div className="flex flex-col items-center space-y-4">
            <div
              className="relative cursor-pointer group"
              onClick={() =>
                setShowProfilePicTemplates(!showProfilePicTemplates)
              }
            >
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center relative overflow-hidden">
                {currentTemplate ? (
                  <img
                    src={currentTemplate.url}
                    alt={currentTemplate.name}
                    className="w-20 h-20 rounded-full"
                  />
                ) : (
                  <span className="text-2xl text-white font-bold">
                    {(profile.displayName || user?.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Profile Picture Templates - Only show when clicked */}
            {showProfilePicTemplates && (
              <div className="glass-surface p-4 rounded-lg space-y-3">
                <h3 className="text-sm font-medium text-center">
                  Choose Avatar
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {PROFILE_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={async () => {
                        await updateProfilePicture(template.id);
                        setShowProfilePicTemplates(false);
                      }}
                      className={`w-12 h-12 rounded-full border-2 transition-all hover:scale-110 ${
                        profile.profilePicture === template.id
                          ? "border-accent ring-2 ring-accent/30"
                          : "border-neutral-300 dark:border-neutral-600 hover:border-accent/50"
                      }`}
                    >
                      <img
                        src={template.url}
                        alt={template.name}
                        className="w-full h-full rounded-full"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1 space-y-6">
            <div>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="Enter display name"
                    className="glass-surface px-4 py-2 rounded-lg flex-1 text-lg font-semibold"
                  />
                  <button
                    onClick={handleNameSave}
                    className="glass-btn px-4 py-2"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="glass-btn px-4 py-2 opacity-70"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl lg:text-3xl font-bold heading">
                    {profile.displayName || user?.email}
                  </h1>
                  <button
                    onClick={handleNameEdit}
                    className="text-accent hover:text-accent/80 transition-colors p-1"
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>
              )}
              {profile.displayName && (
                <p className="text-secondary text-sm mt-1">{user?.email}</p>
              )}
            </div>

            <div className="flex gap-8 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">
                  {Array.isArray(profile.watchlist)
                    ? profile.watchlist.length
                    : 0}
                </div>
                <div className="text-secondary">Total Shows</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">
                  {profile.topRankings.filter((r) => r.isPublic).length}
                </div>
                <div className="text-secondary">Public Rankings</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Watchlist Section */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold heading">My Watchlist</h2>

        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2">
          {WATCH_STATUSES.map(({ status, label, color }) => {
            const count = getWatchlistByStatus(status).length;
            return (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === status
                    ? "bg-accent text-white"
                    : "glass-surface hover:bg-accent/10"
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
          <div className="grid gap-3 grid-cols-3 sm:gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {watchlistItems.map((item) => (
              <div key={item.slug} className="relative group">
                <DramaCard
                  item={
                    {
                      "detail-link": item.slug,
                      title: item.title,
                      image: item.image || "",
                      "latest-episode": "",
                      language: "",
                    } as any
                  }
                  variant="popular"
                />
                {item.progress && (
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="glass-surface px-2 py-1 rounded text-xs">
                      Episode {item.progress.currentEpisode}
                      {item.progress.totalEpisodes &&
                        ` / ${item.progress.totalEpisodes}`}
                    </div>
                  </div>
                )}
                {item.rating && (
                  <div className="absolute top-2 right-2">
                    <div className="glass-surface px-2 py-1 rounded text-xs flex items-center gap-1">
                      <span className="text-yellow-500">★</span>
                      {item.rating}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-10 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold heading">No shows yet</h3>
            <p className="text-sm text-secondary">
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold heading">My Top 10 K-Dramas</h2>
          <button
            onClick={() => setEditingRanking(!editingRanking)}
            className="glass-btn px-4 py-2"
          >
            {editingRanking ? "Done" : "Edit Rankings"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((rank) => {
            const ranking = profile.topRankings.find((r) => r.rank === rank);

            return (
              <div key={rank} className="glass-surface p-4 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold text-sm">
                    {rank}
                  </div>

                  {ranking ? (
                    <div className="flex-1 flex items-center gap-3">
                      {ranking.image && (
                        <img
                          src={ranking.image}
                          alt={ranking.title}
                          className="w-12 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium heading">{ranking.title}</h3>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-yellow-500">★</span>
                          <span>{ranking.rating}/10</span>
                          <span className="text-secondary">•</span>
                          <span
                            className={
                              ranking.isPublic
                                ? "text-green-500"
                                : "text-secondary"
                            }
                          >
                            {ranking.isPublic ? "Public" : "Private"}
                          </span>
                        </div>
                      </div>

                      {editingRanking && (
                        <button
                          onClick={async () => await removeFromTopRanking(rank)}
                          className="text-red-500 hover:text-red-400 transition-colors"
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
                  ) : (
                    <div className="flex-1 text-secondary text-sm">
                      Empty slot - add a drama to rank #{rank}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
