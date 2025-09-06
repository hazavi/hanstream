import { fetchEpisode, EpisodeResponse, EpisodeResult } from '../../../../lib/api';
import Link from 'next/link';
import type { Metadata } from 'next';
import { EpisodesNavigation } from './EpisodesNavigation';

export async function generateMetadata({ params }: { params: { slug: string; episode: string } }): Promise<Metadata> {
  try {
    const data = await fetchEpisode(params.slug, params.episode);
    return { title: data.result?.title || `${params.slug} episode ${params.episode}` };
  } catch {
    return { title: `${params.slug} episode ${params.episode}` };
  }
}

export default async function EpisodePage({ params }: { params: { slug: string; episode: string } }) {
  const data: EpisodeResponse = await fetchEpisode(params.slug, params.episode);
  const ep: EpisodeResult = data.result;
  if (!ep) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold heading">Episode not found</h1>
  <p className="text-sm text-secondary">The episode you&apos;re looking for may have been removed.</p>
        <Link href={`/${params.slug}`} className="glass-btn mt-4 inline-block">Back to drama</Link>
      </div>
    );
  }
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Breadcrumb Navigation */}
  <nav className="flex items-center gap-2 text-sm text-secondary">
        <Link 
          href={`/${params.slug}`} 
          className="hover:text-primary transition-colors font-medium"
        >
          {ep.category?.title || params.slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
  <span className="text-primary font-medium">
          Episode {params.episode}
        </span>
      </nav>

      {/* Episode Title */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl lg:text-3xl font-bold heading leading-tight">
            {ep.title}
          </h1>
          {ep.type && (
            <span className={`badge ${
              ep.type === 'SUB' 
                ? 'badge-sub'
                : ep.type === 'DUB'
                ? 'badge-dub'
                : 'badge-sub'
            }`}>
              {ep.type}
            </span>
          )}
        </div>
      </div>

      {/* Video Player */}
      <div className="relative">
        <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-900 shadow-2xl">
          <iframe 
            src={ep.video} 
            allowFullScreen 
            className="w-full h-full border-0" 
            title={ep.title}
          />
        </div>
      </div>

      {/* Episodes Navigation */}
      {Array.isArray(ep.episodes) && ep.episodes.length > 0 && (
        <EpisodesNavigation
          episodes={ep.episodes}
          currentEpisode={params.episode}
          dramaSlug={params.slug}
        />
      )}
    </div>
  );
}
