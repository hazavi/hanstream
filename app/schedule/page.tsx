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
  try {
    console.log("Fetching schedule data...");

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;
    // Fetch directly from the external API to avoid SSR issues with internal API routes
    const res = await fetch(`${API_BASE_URL}/schedule`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error(`External API failed with status: ${res.status}`);
      throw new Error(
        `Failed to fetch schedule: ${res.status} ${res.statusText}`
      );
    }

    const data = await res.json();

    // Validate the response structure
    if (!data || !data.result || !data.result.days) {
      console.error("Invalid schedule data structure:", data);

      // Return fallback structure
      return {
        error: null,
        page: "schedule",
        result: {
          days: {
            monday: { count: 0, day: "Monday", dramas: [] },
            tuesday: { count: 0, day: "Tuesday", dramas: [] },
            wednesday: { count: 0, day: "Wednesday", dramas: [] },
            thursday: { count: 0, day: "Thursday", dramas: [] },
            friday: { count: 0, day: "Friday", dramas: [] },
            saturday: { count: 0, day: "Saturday", dramas: [] },
            sunday: { count: 0, day: "Sunday", dramas: [] },
          },
          schedule_note: "Schedule data temporarily unavailable",
        },
        status: 200,
      };
    }

    console.log("Successfully fetched schedule data");
    return data;
  } catch (error) {
    console.error("Error in fetchSchedule:", error);

    // Return fallback data instead of throwing
    return {
      error: null,
      page: "schedule",
      result: {
        days: {
          monday: { count: 0, day: "Monday", dramas: [] },
          tuesday: { count: 0, day: "Tuesday", dramas: [] },
          wednesday: { count: 0, day: "Wednesday", dramas: [] },
          thursday: { count: 0, day: "Thursday", dramas: [] },
          friday: { count: 0, day: "Friday", dramas: [] },
          saturday: { count: 0, day: "Saturday", dramas: [] },
          sunday: { count: 0, day: "Sunday", dramas: [] },
        },
        schedule_note: "Unable to load schedule data at this time",
      },
      status: 200,
    };
  }
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
          {schedule_note
            ? schedule_note.startsWith("T")
              ? schedule_note
              : `T${schedule_note}`
            : "Weekly drama schedule"}
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
