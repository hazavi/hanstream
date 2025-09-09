"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const searchQuery = query.trim().toLowerCase().replace(/\s+/g, "-");
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Focus input when Ctrl + K is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="search-bar">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dramas..."
          className="search-input w-full pr-28"
        />

        <div className="search-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Keyboard shortcut hint - simple and small */}
        <span className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-0.5">
          <kbd className="px-1 py-0.5 text-[9px] font-normal bg-gray-100 dark:bg-black text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded">
            Ctrl
          </kbd>
          <kbd className="px-1 py-0.5 text-[9px] font-normal bg-gray-100 dark:bg-black text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded">
            K
          </kbd>
        </span>

        <button type="submit" className="search-button ">
          <svg
            className="w-4 h-4 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}
