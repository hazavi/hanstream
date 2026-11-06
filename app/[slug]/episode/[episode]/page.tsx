import {webRuntime} from "@/lib/deployment";
import {ReaderPage} from "@/components/ReaderPage";
import { fetchEpisode } from "@/lib/api";
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
    const episodeData=await fetchEpisode(slug,episode);
    const title=episodeData.result?.title || formatEpisodeLabel(episode);
    const description='Watch '+(episodeData.result?.category?.title || slug)+', '+formatEpisodeLabel(episode);
    const image=undefined;

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
 if (webRuntime()) return <ReaderPage view="watch" routeSlug={slug} routeEpisode={episode} />;
 const playback = await fetchEpisode(slug, episode);
 return <WatchPage result={playback.result} slug={slug} episode={episode} />;
}
