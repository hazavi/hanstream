"use client";

import Link from "next/link";
import Image from "next/image";

interface Drama {
  countdown: string;
  countdown_seconds: number;
  detail_link: string;
  episode_count: number;
  external_link: string;
  image: string;
  release_status: string;
  release_timestamp: number | null;
  slug: string;
  subtitle_type: string | null;
  title: string;
}

interface ScheduleDramaCardProps {
  drama: Drama;
}

export function ScheduleDramaCard({ drama }: ScheduleDramaCardProps) {
  const fallbackImage =
    "https://kissasian.dk/wp-content/themes/dramastream/assets/images/noimg165px.png";

  return (
    <Link
      href={drama.detail_link}
      className="schedule-drama-list-item block p-3 rounded-lg group transition-all duration-200"
    >
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-12 flex-shrink-0 rounded-md overflow-hidden schedule-drama-image">
          <Image
            src={drama.image || fallbackImage}
            alt={drama.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
            sizes="40px"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = fallbackImage;
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="schedule-drama-title font-medium text-sm truncate mb-1 transition-colors">
            {drama.title}
          </h4>
          <div className="flex items-center gap-3 text-xs">
            <span className="schedule-drama-meta">
              Ep {drama.episode_count}
            </span>
            {drama.countdown && drama.release_status === "upcoming" && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full schedule-status-upcoming-dot"></div>
                <span className="schedule-status-upcoming font-medium">
                  {drama.countdown}
                </span>
              </div>
            )}
            {drama.release_status === "released" && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full schedule-status-available-dot"></div>
                <span className="schedule-status-available font-medium">
                  Available
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="schedule-drama-arrow opacity-0 group-hover:opacity-100 transition-opacity">
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
        </div>
      </div>
    </Link>
  );
}
