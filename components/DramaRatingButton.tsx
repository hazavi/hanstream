"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { Portal } from "./Portal";
import Image from "next/image";

interface DramaRatingButtonProps {
  slug: string;
  title: string;
  image?: string;
}

export function DramaRatingButton({
  slug,
  title,
  image,
}: DramaRatingButtonProps) {
  const { user } = useAuth();
  const { profile, rateItem } = useProfile();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tempRating, setTempRating] = useState(10);

  if (!user || !profile) {
    return null;
  }

  const watchlist = Array.isArray(profile.watchlist) ? profile.watchlist : [];
  const existingItem = watchlist.find((item) => item.slug === slug);

  // Only show if drama is marked as finished
  if (!existingItem || existingItem.status !== "finished") {
    return null;
  }

  const handleRatingClick = () => {
    setTempRating(existingItem.rating || 10);
    setShowRatingModal(true);
  };

  return (
    <>
      {existingItem.rating ? (
        <button
          onClick={handleRatingClick}
          className="absolute top-4 right-4 z-50 drama-rating-badge clickable"
        >
          <svg
            className="w-4 h-4"
            fill="#fbbf24"
            stroke="none"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className="score">{existingItem.rating}/10</span>
        </button>
      ) : (
        <button
          onClick={handleRatingClick}
          className="absolute top-4 right-4 z-50 drama-add-rating-button"
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
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
          <span className="text">Add Rating</span>
        </button>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <Portal>
          <div
            className="search-modal-overlay z-[9999]"
            onClick={() => setShowRatingModal(false)}
          >
            <div className="search-modal" onClick={(e) => e.stopPropagation()}>
              <div className="search-modal-header">
                <h3 className="text-lg font-semibold">
                  {existingItem.rating ? "Edit Rating" : "Add Rating"}
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
                    {image && (
                      <Image
                        src={image}
                        alt={title}
                        width={48}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-foreground">
                      {title}
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
                        await rateItem(slug, tempRating);
                        setShowRatingModal(false);
                      }}
                      className="btn-primary flex-1"
                    >
                      {existingItem.rating ? "Update Rating" : "Add Rating"}
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
        </Portal>
      )}
    </>
  );
}
