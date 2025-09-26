"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchSearchClient, SearchResultItem } from "@/lib/api";
import Image from "next/image";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search function
  const debouncedSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await fetchSearchClient(searchQuery, 1);
      const results = data?.results || [];
      setSuggestions(results.slice(0, 8)); // Show max 8 suggestions
      setShowDropdown(results.length > 0);
    } catch (error) {
      console.error("Search suggestions error:", error);
      // Don't show error to user, just hide dropdown silently
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce timer
  useEffect(() => {
    const timer = setTimeout(() => {
      debouncedSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, debouncedSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const searchQuery = query.trim().toLowerCase().replace(/\s+/g, "-");
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setShowDropdown(false);
    }
  };

  const selectSuggestion = (suggestion: SearchResultItem) => {
    // Navigate directly to the drama detail page
    router.push(suggestion["detail-link"]);
    setShowDropdown(false);
    setQuery("");
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          selectSuggestion(suggestions[selectedIndex]);
        } else {
          if (query.trim()) {
            const searchQuery = query.trim().toLowerCase().replace(/\s+/g, "-");
            router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
            setShowDropdown(false);
          }
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);

    if (!value.trim()) {
      setShowDropdown(false);
      setSuggestions([]);
    }
  };

  // Focus input when Ctrl + K is pressed
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="search-bar">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search dramas..."
            className="search-input w-full pr-28"
            autoComplete="off"
          />

          <div className="search-icon">
            {isLoading ? (
              <svg
                className="animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            ) : (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            )}
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

          <button type="submit" className="search-button">
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

      {/* Search Suggestions Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="search-dropdown absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-y-auto"
        >
          {isLoading && suggestions.length === 0 ? (
            <div className="search-dropdown-loading flex items-center justify-center p-4">
              <svg
                className="animate-spin w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="text-sm">Searching...</span>
            </div>
          ) : (
            suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion["detail-link"]}-${index}`}
                className={`search-dropdown-item flex items-center gap-2.5 p-2.5 cursor-pointer ${
                  index === selectedIndex ? "search-dropdown-item-selected" : ""
                } ${index === 0 ? "rounded-t-lg" : ""} ${
                  index === suggestions.length - 1 ? "rounded-b-lg" : ""
                }`}
                onClick={() => selectSuggestion(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="search-dropdown-image relative w-10 h-13 flex-shrink-0">
                  {suggestion.image ? (
                    <Image
                      src={suggestion.image}
                      alt={suggestion.title}
                      fill
                      className="object-cover"
                      sizes="30px"
                      unoptimized
                    />
                  ) : (
                    <div className="search-dropdown-icon-placeholder w-full h-full flex items-center justify-center">
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
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="search-dropdown-title text-sm truncate">
                    {suggestion.title}
                  </h4>
                  <p className="search-dropdown-subtitle mt-0.5">Drama</p>
                </div>
                <div className="search-dropdown-arrow flex-shrink-0">
                  <svg
                    className="w-3.5 h-3.5"
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
            ))
          )}

          {suggestions.length > 0 && (
            <div className="search-dropdown-footer px-3 py-2 rounded-b-lg">
              <p className="text-xs text-center leading-relaxed">
                Press <kbd className="search-dropdown-kbd">Enter</kbd> to search
                for &quot;{query}&quot; or click a suggestion
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
