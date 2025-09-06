"use client";
import { useState } from 'react';
import Link from 'next/link';
import { formatRelativeTime } from '../../../../lib/api';

interface Episode {
  id: string;
  title?: string;
  type?: string;
  time?: string;
}

interface EpisodesNavigationProps {
  episodes: Episode[];
  currentEpisode: string;
  dramaSlug: string;
}

export function EpisodesNavigation({ episodes, currentEpisode, dramaSlug }: EpisodesNavigationProps) {
  const [showAll, setShowAll] = useState(false);
  const displayedEpisodes = showAll ? episodes : episodes.slice(0, 12);
  const hasMore = episodes.length > 12;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold heading">
          All Episodes ({episodes.length})
        </h2>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {displayedEpisodes.map((e) => {
          const epNum = e.id.split('/').filter(Boolean).pop();
          const active = epNum === currentEpisode;
          return (
            <Link 
              key={e.id} 
              href={`/${dramaSlug}/episode/${epNum}`} 
              className={`group relative rounded-lg text-sm font-medium transition-all duration-200 overflow-hidden
                ${active
                  ? 'episode-active'
                  : 'episode-inactive'
                }`}
            >
              <div className="p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold subtle">EP</span>
                  {e.type && (
                    <span className={`badge ${
                      e.type === 'SUB' 
                        ? active 
                          ? 'badge-soft-sub' 
                          : 'badge-sub'
                        : active
                        ? 'badge-soft-dub'
                        : 'badge-dub'
                    }`}>
                      {e.type}
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <span className="text-base font-bold">{epNum}</span>
                </div>
                {e.time && (
                  <div className="text-xs faint text-center truncate">
                    {formatRelativeTime(e.time)}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      
      {hasMore && !showAll && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowAll(true)}
            className="glass-btn"
          >
            <span>View All Episodes</span>
          </button>
        </div>
      )}
      
      {showAll && hasMore && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowAll(false)}
            className="glass-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <span>Show Less</span>
          </button>
        </div>
      )}
    </section>
  );
}
