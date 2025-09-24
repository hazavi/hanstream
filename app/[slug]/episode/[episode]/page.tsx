import { fetchEpisode, EpisodeResult, fetchDrama } from "../../../../lib/api";
import Link from "next/link";
import type { Metadata } from "next";
import { EpisodesNavigation } from "./EpisodesNavigation";
import { EpisodeProgressTracker } from "@/components/EpisodeProgressTracker";
import { Breadcrumb } from "@/components/Breadcrumb";
import { VideoControls } from "@/components/VideoControls";
import { VideoPlayer } from "@/components/VideoPlayer";

// Next.js 15 PageProps constraint requires params to be Promise<any> | undefined
// So we make params always a Promise to satisfy the constraint
type EpisodeRouteParams = { slug: string; episode: string };
interface EpisodePageProps {
  params: Promise<EpisodeRouteParams>;
}

export async function generateMetadata({
  params,
}: EpisodePageProps): Promise<Metadata> {
  const { slug, episode } = await params;
  try {
    const data = await fetchEpisode(slug, episode);
    return { title: data.result?.title || `${slug} episode ${episode}` };
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

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Progress Tracker - Auto tracks episode viewing */}
      <EpisodeProgressTracker
        slug={slug}
        episode={episode}
        title={
          ep.category?.title ||
          drama?.title ||
          slug
            .replace(/-/g, " ")
            .replace(/\b\w/g, (l: string) => l.toUpperCase())
        }
        image={drama?.image}
        totalEpisodes={ep.episodes?.length}
      />

      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          {
            label:
              ep.category?.title ||
              drama?.title ||
              slug
                .replace(/-/g, " ")
                .replace(/\b\w/g, (l: string) => l.toUpperCase()),
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

      {/* Video Player */}
      <div className="relative video-container">
        <VideoPlayer src={ep.video} title={ep.title} currentEpisode={episode} />
      </div>

      {/* Video Controls */}
      {Array.isArray(ep.episodes) && ep.episodes.length > 0 && (
        <VideoControls
          episodes={ep.episodes.filter((ep): ep is { id: string } =>
            Boolean(ep.id)
          )}
          currentEpisode={episode}
          slug={slug}
        />
      )}

      {/* Episode Progress Tracker */}
      <EpisodeProgressTracker
        slug={slug}
        episode={episode}
        title={
          ep.category?.title ||
          drama?.title ||
          slug
            .replace(/-/g, " ")
            .replace(/\b\w/g, (l: string) => l.toUpperCase())
        }
        image={drama?.image}
        totalEpisodes={ep.episodes?.length}
      />

      {/* Episodes Navigation */}
      {Array.isArray(ep.episodes) && ep.episodes.length > 0 && (
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
      )}
    </div>
  );
}
