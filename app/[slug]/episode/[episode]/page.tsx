import { fetchEpisode, EpisodeResult, fetchDrama, fetchPopular } from "../../../../lib/api";
import Link from "next/link";
import type { Metadata } from "next";
import { EpisodesNavigation } from "./EpisodesNavigation";
import { EpisodeProgressTracker } from "@/components/EpisodeProgressTracker";
import { Breadcrumb } from "@/components/Breadcrumb";
import { VideoControls } from "@/components/VideoControls";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Suspense } from "react";

// Next.js 15 PageProps constraint requires params to be Promise<any> | undefined
// So we make params always a Promise to satisfy the constraint
type EpisodeRouteParams = { slug: string; episode: string };
interface EpisodePageProps {
  params: Promise<EpisodeRouteParams>;
}

// Generate static paths for popular drama episodes at build time
export async function generateStaticParams() {
  try {
    const data = await fetchPopular(1);
    const paths: EpisodeRouteParams[] = [];
    
    // Get first 10 popular dramas
    const popularDramas = data.results.slice(0, 10);
    
    for (const drama of popularDramas) {
      const slug = drama['detail-link'].split('/').filter(Boolean).pop();
      if (!slug) continue;
      
      try {
        // Fetch drama to get episode count
        const dramaData = await fetchDrama(slug);
        const episodeCount = dramaData.result?.episodes?.length || 0;
        
        // Generate paths for first 3 episodes of each popular drama
        for (let i = 1; i <= Math.min(3, episodeCount); i++) {
          paths.push({ slug, episode: String(i) });
        }
      } catch {
        // Skip if drama fetch fails
        continue;
      }
    }
    
    return paths;
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: EpisodePageProps): Promise<Metadata> {
  const { slug, episode } = await params;
  try {
    const [episodeData, dramaData] = await Promise.all([
      fetchEpisode(slug, episode),
      fetchDrama(slug),
    ]);
    const title = episodeData.result?.title || `${slug} episode ${episode}`;
    const description = `Watch ${dramaData.result?.title || slug} Episode ${episode}`;
    const image = dramaData.result?.image;
    
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: image ? [{ url: image }] : [],
      },
    };
  } catch {
    return { title: `${slug} episode ${episode}` };
  }
}

export default async function EpisodePage({ params }: EpisodePageProps) {
  const { slug, episode } = await params;

  // Fetch both episode and drama data in parallel
  const [episodeData, dramaData] = await Promise.all([
    fetchEpisode(slug, episode),
    fetchDrama(slug),
  ]);

  const ep: EpisodeResult = episodeData.result;
  const drama = dramaData.result;

  if (!ep) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold heading">Episode not found</h1>
        <p className="text-sm text-secondary">
          The episode you&apos;re looking for may have been removed.
        </p>
        <Link href={`/${slug}`} className="glass-btn mt-4 inline-block">
          Back to drama
        </Link>
      </div>
    );
  }

  const dramaTitle = ep.category?.title ||
    drama?.title ||
    slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l: string) => l.toUpperCase());

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Progress Tracker - Auto tracks episode viewing */}
      <Suspense fallback={null}>
        <EpisodeProgressTracker
          slug={slug}
          episode={episode}
          title={dramaTitle}
          image={drama?.image}
          totalEpisodes={ep.episodes?.length}
        />
      </Suspense>

      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          {
            label: dramaTitle,
            href: `/${slug}`,
          },
          { label: `Episode ${episode}`, isActive: true },
        ]}
      />

      {/* Episode Title */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl lg:text-3xl font-bold heading leading-tight">
            {ep.title}
          </h1>
          {ep.type && (
            <span
              className={`badge ${
                ep.type === "SUB"
                  ? "badge-sub"
                  : ep.type === "DUB"
                  ? "badge-dub"
                  : "badge-sub"
              }`}
            >
              {ep.type}
            </span>
          )}
        </div>
      </div>

      {/* Two Column Layout: Video Player + Episodes List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Video Player (Larger) */}
        <div className="lg:col-span-9 space-y-6">
          {/* Video Player */}
          <Suspense fallback={
            <div className="relative video-container aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          }>
            <div className="relative video-container aspect-video">
              <VideoPlayer
                src={ep.video}
                title={ep.title}
                currentEpisode={episode}
              />
            </div>
          </Suspense>

          {/* Video Controls */}
          {Array.isArray(ep.episodes) && ep.episodes.length > 0 && (
            <Suspense fallback={
              <div className="h-16 glass-card rounded-xl animate-pulse" />
            }>
              <VideoControls
                episodes={ep.episodes.filter((ep): ep is { id: string } =>
                  Boolean(ep.id)
                )}
                currentEpisode={episode}
                slug={slug}
              />
            </Suspense>
          )}
        </div>

        {/* Right Column: Episodes List - Full height matching video + controls */}
        <div className="lg:col-span-3">
          <div
            className="glass-card p-4 overflow-hidden flex flex-col"
            style={{ height: "480px" }}
          >
            {Array.isArray(ep.episodes) && ep.episodes.length > 0 && (
              <Suspense fallback={
                <div className="space-y-2 h-full flex flex-col">
                  <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-12 bg-gray-300 dark:bg-gray-700 rounded animate-pulse" />
                    ))}
                  </div>
                </div>
              }>
                <EpisodesNavigation
                  episodes={ep.episodes.filter(
                    (
                      ep
                    ): ep is {
                      id: string;
                      title?: string;
                      type?: string;
                      time?: string;
                    } => Boolean(ep.id)
                  )}
                  currentEpisode={episode}
                  dramaSlug={slug}
                />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
