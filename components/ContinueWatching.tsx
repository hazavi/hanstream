"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { DramaCard } from "./DramaCard";
import { ConfirmationModal } from "./ConfirmationModal";
import { PopularItem } from "@/lib/api";
import Link from "next/link";

export function ContinueWatching() {
  const { user, loading } = useAuth();
  const { getContinueWatching, removeFromContinueWatching, profile } =
    useProfile();
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    dramaTitle: string;
    dramaSlug: string;
  }>({
    isOpen: false,
    dramaTitle: "",
    dramaSlug: "",
  });

  // Don't render anything while loading authentication state
  if (loading) {
    return null;
  }

  // Don't render if user is not authenticated
  if (!user) {
    return null;
  }

  // Don't render if profile is not loaded yet
  if (!profile) {
    return null;
  }

  const continueWatchingItems = getContinueWatching();

  if (continueWatchingItems.length === 0) {
    return null;
  }

  const handleRemoveClick = (dramaTitle: string, dramaSlug: string) => {
    setConfirmModal({
      isOpen: true,
      dramaTitle,
      dramaSlug,
    });
  };

  const handleConfirmRemove = async () => {
    if (confirmModal.dramaSlug) {
      await removeFromContinueWatching(confirmModal.dramaSlug);
    }
    setConfirmModal({
      isOpen: false,
      dramaTitle: "",
      dramaSlug: "",
    });
  };

  const handleCloseModal = () => {
    setConfirmModal({
      isOpen: false,
      dramaTitle: "",
      dramaSlug: "",
    });
  };

  return (
    <>
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold heading">Continue Watching</h2>
          <Link
            href={`/profile/${user.uid}`}
            className="text-sm text-accent hover:text-accent/80 transition-colors font-medium"
          >
            View All
          </Link>
        </div>

        <div className="grid gap-3 grid-cols-2 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {continueWatchingItems.slice(0, 12).map((item) => {
            return (
              <div key={item.slug} className="relative group">
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

                {/* Remove button (top-right corner) */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemoveClick(item.title, item.slug);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 hover:bg-black/20 cursor-pointer"
                  title="Remove from continue watching"
                >
                  <svg
                    className="w-4 h-4 text-white drop-shadow-lg"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>

                {/* Episode info overlay - top left, only shown on hover */}
                <div className="absolute top-2 left-2 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                  <div className="text-md text-white drop-shadow-lg">
                    <div className="font-medium leading-tight">
                      Episode {item.currentEpisode}
                      {item.totalEpisodes && ` of ${item.totalEpisodes}`}
                    </div>
                    <div className="text-gray-300 text-[12px] leading-tight mt-0.5">
                      {new Date(item.lastWatched).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Continue watching button overlay (shown on hover) */}
                <Link
                  href={`/${item.slug}/episode/${item.currentEpisode || 1}`}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  <div className="flex items-center gap-2 glass-btn px-4 py-2">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span className="text-sm font-medium">Continue</span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmRemove}
        title="Remove from Continue Watching"
        message={`Are you sure you want to remove "${confirmModal.dramaTitle}" from the row?`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}
