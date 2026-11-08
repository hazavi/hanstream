"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { pauseRequest, waitForActivePage } from '@/lib/request-retry';
import { isPublishedImage } from "@/lib/image-utils.mjs";
import {
  artworkFailedRecently,
  artworkWinner,
  claimArtworkRetry,
  failArtwork,
  rememberArtwork,
  subscribeArtwork,
} from "@/lib/artwork-cache";

export function Artwork({
  sources,
  alt,
  poster = false,
  movie = false,
  placeholder = "Artwork unavailable",
  title,
  year,
  person,
  personKey,
  fallbackLabel,
}: {
  sources: (string | undefined)[];
  alt: string;
  poster?: boolean;
  movie?: boolean;
  placeholder?: string;
  title?: string;
  year?: number;
  person?: string;
  personKey?: string;
  fallbackLabel?: string;
}) {
  const container = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(poster);
  const [waiting, setWaiting] = useState<{
    key: string;
    source: string;
    round: number;
  }>();
  const pendingRetry = useRef({ key: "", count: 0 });
  useEffect(() => {
    if (poster || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const node = container.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [poster]);
  const loadedSource = useRef<string | undefined>(undefined);
  const recovery = useRef({ key: "", count: 0 });
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
  const fallback = title
    ? `${base}/api/artwork?${new URLSearchParams({ title, ...(year ? { year: String(year) } : {}), ...(movie?{movie:'1'}:{}),revision:'4' })}`
    : undefined;
  const portrait = person
    ? `${base}/api/portrait?${new URLSearchParams({ name: person, ...(personKey ? { key: personKey } : {}) })}`
    : undefined;
  const candidates = [
    ...new Set(
      [...sources, portrait, fallback].filter((src): src is string =>
        isPublishedImage(src),
      ),
    ),
  ];
  const [failure, setFailure] = useState({ key: "", attempt: 0 });
  const key = JSON.stringify(candidates);
  const attempt = failure.key === key ? failure.attempt : 0;
  const source = candidates[attempt];
  const waitingForCurrent = waiting?.key === key && waiting.source === source;
  useEffect(() => {
    if (!waitingForCurrent || !waiting) return;
    const timer = setTimeout(
      () => setWaiting(undefined),
      [1000, 2000, 4000, 8000, 10000][waiting.round],
    );
    return () => clearTimeout(timer);
  }, [waiting, waitingForCurrent]);
  useEffect(() => {
    const items = JSON.parse(key) as string[];
    const restore = () => {
      const winner = artworkWinner(key);
      const index = winner ? items.indexOf(winner) : -1;
      if (index >= 0)
        setFailure((previous) =>
          previous.key === key && previous.attempt === index
            ? previous
            : { key, attempt: index },
        );
    };
    restore();
    return subscribeArtwork(key, restore);
  }, [key]);
  useEffect(() => {
    if (!near || source || key === "[]") return;
    if (recovery.current.key !== key) recovery.current = { key, count: 0 };
    const controller=new AbortController();
    void (async()=>{
      while(!controller.signal.aborted){
        await pauseRequest([6000,65_000,120_000,300_000][Math.min(recovery.current.count,3)],controller.signal);
        await waitForActivePage(controller.signal);
        recovery.current.count++;
        if (claimArtworkRetry(key)) {
          pendingRetry.current = { key: '', count: 0 };
          setFailure({ key, attempt: 0 });
          return;
        }
      }
    })().catch(()=>{});
    return () => controller.abort();
  }, [source, key, near]);
  useEffect(() => {
    if (
      !near ||
      !source ||
      !/^https?:/.test(source) ||
      source.startsWith(base + "/api/")
    )
      return;
    const timer = setTimeout(() => {
      if (loadedSource.current === source) return;
      failArtwork(key, source);
      setFailure({ key, attempt: attempt + 1 });
    }, 3500);
    return () => clearTimeout(timer);
  }, [source, key, attempt, base, near]);
  return (
    <span ref={container} className="absolute inset-0 block">
      {near && source && !waitingForCurrent ? (
        <Image
          key={source}
          src={source}
          alt={alt}
          fill
          sizes={
            person
              ? "64px"
              : poster
                ? "(max-width: 640px) 65vw, 300px"
                : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
          }
          className="object-cover"
          priority={poster}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(event) => {
            const queued =
              source.startsWith(base + "/api/") &&
              event.currentTarget.naturalWidth === 3 &&
              event.currentTarget.naturalHeight === 2;
            if (queued) {
              const retryKey = key + source;
              if (pendingRetry.current.key !== retryKey)
                pendingRetry.current = { key: retryKey, count: 0 };
              if (pendingRetry.current.count >= 5) {
                failArtwork(key, source);
                setFailure({ key, attempt: attempt + 1 });
                return;
              }
              const round = pendingRetry.current.count++;
              setWaiting({ key, source, round });
              return;
            }
            const generated =
              source.startsWith(base + "/api/") &&
              event.currentTarget.naturalWidth === 2 &&
              event.currentTarget.naturalHeight === 3;
            if (generated) {
              failArtwork(key, source);
              setFailure({ key, attempt: attempt + 1 });
              return;
            }
            loadedSource.current = source;
            pendingRetry.current = { key: "", count: 0 };
            rememberArtwork(key, source);
          }}
          onError={() => {
            failArtwork(key, source);
            let next = attempt + 1;
            while (
              next < candidates.length &&
              artworkFailedRecently(candidates[next])
            )
              next++;
            setFailure({ key, attempt: next });
          }}
        />
      ) : (
        <div
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
          aria-hidden={alt ? undefined : true}
          className="absolute inset-0 surface flex flex-col items-center justify-center gap-2 p-2 text-secondary"
        >
          {!near || waitingForCurrent ? (
            <span className="text-xs animate-pulse">
              {near ? "Loading artwork" : ""}
            </span>
          ) : person ? (
            <UserRound size={24} aria-hidden="true" className="opacity-40" />
          ) : (
            <>
              {(alt || fallbackLabel) && (
                <span
                  aria-hidden="true"
                  className="text-3xl font-semibold opacity-40"
                >
                  {fallbackLabel ??
                    alt
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join("")}
                </span>
              )}
              <span className="text-xs">{placeholder}</span>
            </>
          )}
        </div>
      )}
    </span>
  );
}
