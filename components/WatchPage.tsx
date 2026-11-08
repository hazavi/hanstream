"use client";

import { Breadcrumb } from "./Breadcrumb";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { readBackend, peekBackend, subscribeBackend } from "@/lib/pages-client";
import type {
  DramaDetail,
  DramaResponse,
  EpisodeResult,
} from "@/lib/api-types";
import { EpisodePlayer } from "./EpisodePlayer";
import { EpisodeList } from "./EpisodeList";
import { EpisodeProgressTracker } from "./EpisodeProgressTracker";
import { VideoControls } from "./VideoControls";
import { formatEpisodeLabel } from "@/lib/format";
import { detailNeedsRefresh } from "@/lib/detail-cache";
import { isPlaybackResponse } from "@/lib/playback-response";
import {
  pauseRequest,
  retryWhileActive,
  waitForActivePage,
} from "@/lib/request-retry";
import { toast } from "./ui/toast";
import { englishText } from '@/lib/display-language';

const emptyPlayback: EpisodeResult = {
  title: "Episode",
  video: "",
  episodes: [],
};

export function WatchPage({
  result = emptyPlayback,
  drama: initialDrama,
  slug,
  episode,
}: {
  result?: EpisodeResult;
  drama?: DramaDetail;
  slug: string;
  episode: string;
}) {
  const detailPath = "/api/drama/" + encodeURIComponent(slug);
  const [details, setDetails] = useState<{
    slug: string;
    value: DramaDetail | undefined;
  }>(() => ({
    slug,
    value: initialDrama || peekBackend<DramaResponse>(detailPath)?.result,
  }));
  const drama =
    details.slug === slug ? details.value || initialDrama : initialDrama;
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const update = () => {
      const value = peekBackend<DramaResponse>(detailPath)?.result;
      if (value && !controller.signal.aborted) setDetails({ slug, value });
    };
    const unsubscribe = subscribeBackend(detailPath, update);
    async function loadDetails() {
      if (attempts > 0) await waitForActivePage(controller.signal);
      let incomplete = true;
      try {
        const data = await readBackend<DramaResponse>(
          detailPath,
          controller.signal,
          { sameOrigin: true, ...(attempts ? { fresh: true } : {}) },
        );
        if (controller.signal.aborted) return;
        if (data.result) setDetails({ slug, value: data.result });
        incomplete = detailNeedsRefresh(data) || !data.result?.episodes?.length;
      } catch {
        /* Playback continues while optional details recover. */
      }
      if (incomplete && !controller.signal.aborted)
        timer = setTimeout(() => {
          attempts++;
          void loadDetails().catch(() => {});
        }, [15_000, 30_000, 60_000][Math.min(attempts, 2)]);
    }
    void loadDetails().catch(() => {});
    return () => {
      controller.abort();
      clearTimeout(timer);
      unsubscribe();
    };
  }, [detailPath, slug]);
  const frameRoot = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState(0);
  const [override, setOverride] = useState<{
    key: string;
    result: EpisodeResult;
  }>();
  const retryController = useRef<AbortController | undefined>(undefined);
  const playbackKey = slug + "/" + episode;
  const playback = override?.key === playbackKey ? override.result : result;
  const episodes = useMemo(() => {
    const published = Array.isArray(drama?.episodes)
      ? drama.episodes
          .filter((ep) => ep && typeof ep.episode_link === "string")
          .map((ep) => ({
            id: ep.episode_link.split("/").pop(),
            title: englishText(ep.title),
            time: ep.release_date,
            season: ep.season,
            episode: ep.episode,
            image: ep.image,
            description: englishText(ep.description),
            available: ep.available,
          }))
      : [];
    const items = published?.length
      ? published
      : Array.isArray(playback.episodes)
        ? playback.episodes
        : [];
    return items.filter((item): item is typeof item & { id: string } =>
      Boolean(item?.id),
    ).map(item => ({...item, title: englishText(item.title), description: englishText(item.description)}));
  }, [drama?.episodes, playback.episodes]);
  const playable = episodes.filter(
    (item) =>
      item.available !== false &&
      (!item.time || Date.parse(item.time) <= Date.now()),
  );
  const selectedEpisode = playback.current_episode || episode;
  const current = episodes.find((item) => item.id === selectedEpisode);
  const title = englishText(drama?.title, result.category?.title) || "Drama";
  useEffect(() => {
    return () => retryController.current?.abort();
  }, [playbackKey]);
  useEffect(() => {
    const frame = frameRoot.current?.querySelector(".video-container");
    if (!frame) return;
    const resize = () => {
      const height = Math.round(frame.getBoundingClientRect().height);
      if (height > 0) setFrameHeight(height);
    };
    resize();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resize)
        : undefined;
    observer?.observe(frame);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [episode, playback.video]);
  const retryEpisode = useCallback(async () => {
    retryController.current?.abort();
    const controller = new AbortController();
    retryController.current = controller;
    try {
      const data = await retryWhileActive(
        async () => {
          const value = await readBackend(
            `/api/episode/${encodeURIComponent(slug)}/${encodeURIComponent(episode)}`,
            controller.signal,
            { fresh: true, sameOrigin: true },
          );
          if (!isPlaybackResponse(value))
            throw new Error("Episode is still loading");
          return value;
        },
        controller.signal,
        () =>
          toast(
            "The video host has not returned a stream yet. We’re checking again automatically.",
            "episode-retry",
          ),
      );
      if (controller.signal.aborted) return;
      setOverride({ key: playbackKey, result: data.result });
      if (!data.result.video)
        toast(
          "No working stream is listed yet. We’ll check again shortly.",
          "episode-unavailable",
        );
    } catch {
      if (!controller.signal.aborted)
        toast("Unable to reload this episode.", "episode-retry-failed");
    }
  }, [slug, episode, playbackKey]);
  useEffect(() => {
    if (playback.video) return;
    const controller = new AbortController();
    void (async () => {
      await pauseRequest(15_000, controller.signal);
      await waitForActivePage(controller.signal);
      if (!controller.signal.aborted) void retryEpisode();
    })().catch(() => {});
    return () => controller.abort();
  }, [playback, playbackKey, retryEpisode]);
  return (
    <div className="watch-page animate-fade-in">
      <header className="watch-heading">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: title, href: `/${slug}` },
            { label: formatEpisodeLabel(selectedEpisode), isActive: true },
          ]}
        />
      </header>
      <div
        className="watch-layout"
        style={
          frameHeight
            ? ({ "--watch-frame-height": frameHeight + "px" } as CSSProperties)
            : undefined
        }
      >
        <div ref={frameRoot} className="watch-primary">
          <EpisodePlayer
            key={`${slug}/${episode}/${playback.video}`}
            video={playback.video}
            servers={playback.servers}
            title={englishText(playback.title) || formatEpisodeLabel(episode)}
            caption={
              <h1 className="watch-caption">
                {formatEpisodeLabel(episode)}
                {current?.title &&
                  current.title.toLowerCase() !==
                    formatEpisodeLabel(episode).toLowerCase() && (
                    <span> · {current.title}</span>
                  )}
              </h1>
            }
            navigation={
              <VideoControls
                episodes={playable}
                currentEpisode={selectedEpisode}
                slug={slug}
              />
            }
          />
          {current?.description && (
            <section className="watch-summary">
              <h2 className="heading text-sm font-semibold mb-2">
                About this episode
              </h2>
              <p className="text-sm text-secondary leading-relaxed">
                {current.description}
              </p>
            </section>
          )}
          <EpisodeProgressTracker
            slug={slug}
            episode={selectedEpisode}
            title={title}
            image={drama?.image}
            totalEpisodes={playable.length}
            enabled={Boolean(playback.video)}
          />
        </div>
        <EpisodeList
          episodes={episodes}
          currentEpisode={selectedEpisode}
          slug={slug}
          poster={drama?.image}
          coverTitle={title}
          coverYear={Number(drama?.meta?.Released) || undefined}
        />
      </div>
    </div>
  );
}
