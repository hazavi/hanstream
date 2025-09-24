"use client";

import { useState } from "react";
import { ScheduleDramaCard } from "@/components/ScheduleDramaCard";

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

interface DaySchedule {
  count: number;
  day: string;
  dramas: Drama[];
}

interface DayCardProps {
  day: string;
  schedule: DaySchedule;
}

export function DayCard({ day, schedule }: DayCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const today = new Date()
    .toLocaleDateString("en", { weekday: "long" })
    .toLowerCase();
  const isToday = day.toLowerCase() === today;

  const dramasToShow = isExpanded
    ? schedule.dramas
    : schedule.dramas.slice(0, 6);
  const hasMore = schedule.dramas.length > 6;

  return (
    <div
      className={`schedule-day-card-clean p-4 sm:p-5 ${isToday ? "today" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold schedule-day-header">
            {schedule.day}
          </h2>
          {isToday && (
            <span className="schedule-today-badge px-2 py-1 text-xs font-medium rounded-full">
              Today
            </span>
          )}
        </div>
        <span className="schedule-day-count px-2 py-1 text-xs font-medium rounded-full">
          {schedule.count}
        </span>
      </div>
      <div className="space-y-1">
        {dramasToShow.map((drama) => (
          <ScheduleDramaCard key={drama.slug} drama={drama} />
        ))}
        {hasMore && (
          <div className="text-center pt-3 pb-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs schedule-drama-meta font-medium px-3 py-1 rounded-full hover:opacity-80 transition-opacity cursor-pointer"
              style={{ background: "var(--card-hover)" }}
            >
              {isExpanded ? "Show less" : `+${schedule.dramas.length - 6} more`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
