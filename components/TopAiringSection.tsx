"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PopularSeriesItem, TopDramaItem } from "../lib/api";

type TabType = "week" | "month" | "day";

export function TopAiringSection() {
  const [activeTab, setActiveTab] = useState<TabType>("day");
  const [data, setData] = useState<{
    week: TopDramaItem[];
    month: TopDramaItem[];
    day: TopDramaItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Ensure component only renders on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Add a small delay to ensure client-side execution
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Use internal API route to avoid CORS issues with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const directResponse = await fetch("/api/popular-series", {
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!directResponse.ok) {
          throw new Error(
            `HTTP ${directResponse.status}: ${directResponse.statusText}`
          );
        }

        const response = await directResponse.json();

        // Check if the API route returned an error
        if (response.error) {
          throw new Error(response.error);
        }

        // Validate the response structure - be more lenient
        if (!response?.result) {
          throw new Error("Invalid response structure: missing result");
        }

        if (!response.result.periods) {
          throw new Error("Invalid response structure: missing periods");
        }

        // Ensure periods is an object with the expected properties
        const periods = response.result.periods;
        if (typeof periods !== "object" || !periods) {
          throw new Error(
            "Invalid response structure: periods is not an object"
          );
        }

        // Set data even if some periods are empty
        setData({
          week: periods.week || [],
          month: periods.month || [],
          day: periods.day || [],
        });
      } catch (err) {
        console.error("Error fetching popular series:", err);
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            setError("Request timed out. Please try again.");
          } else {
            setError(err.message || "Failed to load popular series");
          }
        } else {
          setError("Failed to load popular series");
        }
      } finally {
        setLoading(false);
      }
    };

    // Only run on client side
    if (isClient) {
      loadData();
    }
  }, [isClient]);

  const tabs = [
    { key: "day" as TabType, label: "Daily" },
    { key: "week" as TabType, label: "Weekly" },
    { key: "month" as TabType, label: "Monthly" },
  ];

  const currentList = data?.[activeTab] || [];

  // Don't render until client-side hydration is complete
  if (!isClient) {
    return null;
  }

  if (loading) {
    return (
      <aside className="w-64 mt-100">
        <div className="glass-card p-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-4" />
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                <div className="w-10 h-14 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="w-64 mt-16">
        <div className="glass-card p-4">
          <div className="text-center py-8">
            <p className="text-red-500 text-xs">{error}</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 mt-100">
      <div className="glass-card p-4">
        {/* Clean header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-primary">
            Top Airing Shows
          </h2>
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        </div>

        {/* Smooth minimal tabs */}
        <div className="relative top-airing-tabs rounded-lg p-1 mb-4">
          <div className="flex relative">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-300 ease-out hover:cursor-pointer ${
                  activeTab === tab.key
                    ? "top-airing-tab-active"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {activeTab === tab.key && (
                  <div className="absolute inset-0 top-airing-tab-active rounded-lg" />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Clean content list */}
        <div className="space-y-2">
          {currentList.slice(0, 10).map((item, index) => (
            <Link
              key={item.slug}
              href={item.detail_link}
              className="top-airing-item group flex items-center gap-3 p-2 rounded-lg hover:surface-hover"
            >
              {/* Enhanced rank badge */}
              <div className="flex-shrink-0">
                <div
                  className={`top-airing-rank w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                    index < 3 ? "top-3" : ""
                  }`}
                >
                  {item.rank}
                </div>
              </div>

              {/* Bigger cleaner image */}
              <div className="flex-shrink-0 relative w-10 h-14 rounded-sm overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-sm">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="40px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                  }}
                />
              </div>

              {/* Clean minimal content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-primary group-hover:text-accent transition-colors line-clamp-1 mb-1">
                  {item.title}
                </h3>

                <span className="text-xs text-secondary">
                  {item.release_year}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
