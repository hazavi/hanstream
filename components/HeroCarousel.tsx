"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { HotSeriesUpdateItem } from "@/lib/api";

interface HeroCarouselProps {
  items: HotSeriesUpdateItem[];
}

export function HeroCarousel({ items }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-slide functionality
  useEffect(() => {
    if (items.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [items.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  if (!items.length) {
    return (
      <div className="relative h-48 sm:h-56 md:h-64 lg:h-70 bg-transparent flex items-center justify-center">
        <div className="text-center px-4">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-2">
            No Hot Series Available
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Check back later for updates!
          </p>
        </div>
      </div>
    );
  }

  const currentItem = items[currentIndex];

  return (
    <div className="relative h-48 sm:h-56 md:h-64 lg:h-70 overflow-hidden group bg-transparent">
      {/* Layout for better proportions */}
      <div className="flex h-full">
        {/* Left side - Content (takes more width) */}
        <div className="flex-[2] sm:flex-[2] flex items-center">
          <div className="px-4 sm:px-6 lg:px-12 xl:px-20 py-4 sm:py-6 lg:py-8">
            <div className="max-w-xl lg:max-w-2xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-red-600 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium mb-2 sm:mb-4">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" />
                Hot Update
              </div>

              {/* Title */}
              <h1 className="text-[18px] md:text-[20px] lg:text-[20px] font-bold text-foreground mb-4 leading-tight">
                {currentItem.series_title}
              </h1>

              {/* Episode Info */}
              <p className="text-[14px] md:text-[14px] text-muted-foreground mb-6">
                Episode {currentItem.episode_number} •{" "}
                {currentItem.subtitle_type}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={currentItem.episode_detail_link}
                  className="btn-primary flex items-center gap-2 sm:gap-2 !px-2 sm:!px-3 !py-1.5 sm:!py-2 !text-xs sm:!text-xs"
                >
                  <svg
                    className="w-2.5 h-2.5 sm:w-3 sm:h-3"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="hidden sm:inline">Watch Now</span>
                  <span className="sm:hidden">Watch</span>
                </Link>

                <Link
                  href={currentItem.drama_detail_link}
                  className="glass-btn !px-2 sm:!px-3 !py-1.5 sm:!py-2 !text-xs sm:!text-sm"
                >
                  <span className="hidden sm:inline">More Info</span>
                  <span className="sm:hidden">Info</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Image (smaller for better quality) */}
        <div className="flex-1 relative max-w-xs sm:max-w-sm lg:max-w-lg">
          <Image
            src={currentItem.image}
            alt={currentItem.series_title}
            fill
            className="object-contain object-center"
            priority
            quality={100}
            sizes="(max-width: 640px) 40vw, (max-width: 1024px) 30vw, 25vw"
          />
          {/* Subtle gradient overlay from left */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-transparent dark:from-black/20 pointer-events-none" />
        </div>
      </div>

      {/* Navigation Arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/70 hover:cursor-pointer hover:bg-black/90 backdrop-blur-sm flex items-center justify-center transition-all"
            aria-label="Previous slide"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/70 hover:cursor-pointer hover:bg-black/90 backdrop-blur-sm flex items-center justify-center transition-all"
            aria-label="Next slide"
          >
            <svg
              className="w-5 h-5 text-white"
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
          </button>
        </>
      )}

      {/* Indicators */}
      {items.length > 1 && (
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-1 sm:gap-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-1.5 sm:h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-primary w-6 sm:w-8"
                  : "bg-muted-foreground/50 hover:bg-muted-foreground/70 w-1.5 sm:w-2"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {items.length > 1 && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-muted/30">
          <div
            className="h-full bg-primary transition-all duration-5000 ease-linear"
            style={{
              width: `${((currentIndex + 1) / items.length) * 100}%`,
              animation: `progress 5000ms linear infinite`,
            }}
          />
        </div>
      )}
    </div>
  );
}
