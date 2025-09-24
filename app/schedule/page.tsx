import { Suspense } from "react";
import { DayCard } from "@/components/DayCard";

// Force dynamic rendering to prevent build-time prerendering
export const dynamic = "force-dynamic";

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

interface ScheduleData {
  days: {
    [key: string]: DaySchedule;
  };
  schedule_note: string;
}

interface ScheduleResponse {
  error: null;
  page: string;
  result: ScheduleData;
  status: number;
}

async function fetchSchedule(): Promise<ScheduleResponse> {
  const baseUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : process.env.NEXT_PUBLIC_BASE_URL || "https://hanstream.vercel.app";

  const res = await fetch(`${baseUrl}/api/schedule`, {
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!res.ok) {
    throw new Error("Failed to fetch schedule");
  }

  return res.json();
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-6">
      <div className="schedule-skeleton text-center mb-6 p-2 mx-auto max-w-3xl">
        <div className="h-6 schedule-skeleton-item rounded mb-1 mx-auto w-48"></div>
        <div className="h-3 schedule-skeleton-item rounded mx-auto w-64"></div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="schedule-skeleton p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-6 schedule-skeleton-item rounded w-20"></div>
              <div className="h-6 schedule-skeleton-item rounded-full w-8"></div>
            </div>
            <div className="space-y-1">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="schedule-drama-list-item p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-12 schedule-skeleton-item rounded-md"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 schedule-skeleton-item rounded w-3/4"></div>
                      <div className="h-3 schedule-skeleton-item rounded w-1/2"></div>
                    </div>
                    <div className="w-4 h-4 schedule-skeleton-item rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function ScheduleContent() {
  const data = await fetchSchedule();
  const { days, schedule_note } = data.result;

  // Order days properly starting from Monday
  const orderedDays = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  return (
    <div className="space-y-6">
      <div className="schedule-header text-center mb-6 p-2 mx-auto max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 schedule-day-header">
          Weekly Schedule
        </h1>
        <p className="schedule-drama-meta max-w-xl mx-auto text-xs sm:text-sm leading-relaxed">
          T{schedule_note}
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orderedDays.map((dayKey) => {
          const schedule = days[dayKey];
          if (!schedule) return null;

          return <DayCard key={dayKey} day={dayKey} schedule={schedule} />;
        })}
      </div>

      <div className="text-center text-sm schedule-drama-meta mt-8">
        Schedule updates weekly • Times shown are estimates
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <div className="schedule-page min-h-screen">
      <div className="container mx-auto px-4 py-2 sm:py-4">
        <Suspense fallback={<ScheduleSkeleton />}>
          <ScheduleContent />
        </Suspense>
      </div>
    </div>
  );
}

export const metadata = {
  title: "Weekly Schedule - HanStream",
  description:
    "View the weekly schedule of Korean dramas and shows airing this week.",
};
