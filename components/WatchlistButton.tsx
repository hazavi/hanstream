"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { WatchStatus } from "@/lib/types";

interface WatchlistButtonProps {
  slug: string;
  title: string;
  image?: string;
}

const WATCH_STATUSES: {
  status: WatchStatus;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    status: "watching",
    label: "Watching",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    ),
  },
  {
    status: "paused",
    label: "Paused",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    status: "plan-to-watch",
    label: "Plan to Watch",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    status: "finished",
    label: "Finished",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    status: "dropped",
    label: "Dropped",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
];

export function WatchlistButton({ slug, title, image }: WatchlistButtonProps) {
  const { user } = useAuth();
  const {
    profile,
    addToWatchlist,
    updateWatchlistStatus,
    removeFromWatchlist,
  } = useProfile();
  const [isOpen, setIsOpen] = useState(false);

  if (!user || !profile) {
    return null;
  }

  const watchlist = Array.isArray(profile.watchlist) ? profile.watchlist : [];
  const existingItem = watchlist.find((item) => item.slug === slug);
  const currentStatus = existingItem?.status;

  const handleStatusSelect = async (status: WatchStatus) => {
    if (existingItem) {
      if (existingItem.status === status) {
        // If clicking the same status, remove from watchlist
        await removeFromWatchlist(slug);
      } else {
        // Update existing status
        await updateWatchlistStatus(slug, status);
      }
    } else {
      // Add new item to watchlist
      await addToWatchlist({
        slug,
        title,
        image,
        status,
      });
    }
    setIsOpen(false);
  };

  return (
    <div className="absolute bottom-2 right-2 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200 backdrop-blur-md ${
          existingItem
            ? "bg-black/100 border border-white/20 text-white hover:bg-black/80 hover:border-white/30"
            : "bg-black/100 border border-white/20 text-white hover:bg-black/80 hover:border-white/30"
        }`}
      >
        {existingItem ? (
          WATCH_STATUSES.find((s) => s.status === currentStatus)?.icon || (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )
        ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        )}
        <span className="hidden sm:inline">
          {existingItem
            ? WATCH_STATUSES.find((s) => s.status === currentStatus)?.label ||
              "Listed"
            : "Add to Watchlist"}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute bottom-full mb-2 right-0 z-50 backdrop-blur-xs bg-black/70 dark:min-w-44 rounded-lg shadow-2xl border border-white/20 dark:border-gray-700/50 overflow-hidden">
            <div className="p-1">
              {WATCH_STATUSES.map(({ status, label, icon }) => (
                <button
                  key={status}
                  onClick={() => handleStatusSelect(status)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-all duration-150 ${
                    currentStatus === status
                      ? "bg-accent/20 text-accent"
                      : "hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <div
                    className={`${
                      currentStatus === status
                        ? "text-accent"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {icon}
                  </div>
                  <span className="font-medium text-xs">{label}</span>
                  {currentStatus === status && (
                    <svg
                      className="w-4 h-4 ml-auto text-accent"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </button>
              ))}

              {existingItem && (
                <>
                  <div className="h-px bg-gray-200/50 dark:bg-gray-700/50 mx-1 my-1" />
                  <button
                    onClick={() => {
                      removeFromWatchlist(slug);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-all duration-150"
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
                        strokeWidth={2.5}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    <span className="font-medium text-xs">Remove</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
