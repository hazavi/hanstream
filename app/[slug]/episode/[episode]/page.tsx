import { fetchEpisode, fetchDrama } from "@/lib/api";
import { formatEpisodeLabel } from "@/lib/format";
import { WatchPage } from "@/components/WatchPage";
import type { Metadata } from "next";

interface EpisodePageProps { params: Promise<{ slug: string; episode: string }> }
export const dynamic = "force-dynamic";

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
    const description = `Watch ${dramaData.result?.title || slug}, ${formatEpisodeLabel(episode)}`;
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
 const [playback, drama] = await Promise.all([fetchEpisode(slug, episode), fetchDrama(slug)]);
 return <WatchPage result={playback.result} drama={drama.result} slug={slug} episode={episode} />;
}
