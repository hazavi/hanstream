import Image from 'next/image';
import Link from 'next/link';
import type { RecentItem, PopularItem } from '../lib/api';
import { formatRelativeTime } from '../lib/api';

type DramaCardProps =
  | { item: RecentItem; variant: 'recent' }
  | { item: PopularItem; variant: 'popular' };

export function DramaCard({ item, variant }: DramaCardProps) {
  if (variant === 'recent') {
    const d = item as RecentItem;
    const slug = d['episode-link'].split('/').filter(Boolean)[0];
    const episodeNum = d.episode_number;
    return (
      <Link href={`/${slug}/episode/${episodeNum}`} className="group block animate-slide-up">
        <div className="relative overflow-hidden rounded-2xl glass-card card-hover">
          <div className="relative aspect-[4/5] overflow-hidden">
            <Image
              src={d.image}
              alt={d.title}
              fill
              sizes="(max-width:768px) 50vw, (max-width:1200px) 25vw, 20vw"
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
              priority={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="absolute top-3 left-3 flex gap-2">
              <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-black/70 text-white backdrop-blur-sm">
                EP {episodeNum}
              </span>
              <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${
                d.type === 'SUB' 
                  ? 'bg-blue-500 text-white' 
                  : d.type === 'DUB'
                  ? 'bg-green-500 text-white'
                  : 'bg-purple-500 text-white'
              }`}>
                {d.type}
              </span>
            </div>
            
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="p-4 space-y-2">
            <h3 className="text-sm font-semibold leading-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {d.title}
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <p className="text-xs text-gray-600 dark:text-gray-400">{formatRelativeTime(d.time)}</p>
            </div>
          </div>
        </div>
      </Link>
    );
  }
  
  const p: PopularItem = item;
  const slug = p['detail-link'].replace(/^\//,'');
  return (
    <Link href={`/${slug}`} className="group block animate-slide-up">
      <div className="relative overflow-hidden rounded-2xl glass-card card-hover">
        <div className="relative aspect-[4/5] overflow-hidden">
          <Image
            src={p.image}
            alt={p.title}
            fill
            sizes="(max-width:768px) 50vw, (max-width:1200px) 25vw, 20vw"
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
            priority={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          
        </div>
        
        <div className="p-4">
          <h3 className="text-sm font-semibold leading-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {p.title}
          </h3>
        </div>
      </div>
    </Link>
  );
}
