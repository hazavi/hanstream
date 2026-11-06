"use client";

import { useRef } from "react";
import { MEDIA_SANDBOX, safeEmbedUrl } from '@/lib/embed';

interface VideoPlayerProps {
  src: string;
  title: string;
  currentEpisode: string;
}

export function VideoPlayer({ src, title }: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const safeSrc = safeEmbedUrl(src);

  return (
    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-900 shadow-2xl relative">
      {safeSrc && <iframe
        ref={iframeRef}
        src={safeSrc}
        sandbox={MEDIA_SANDBOX}
        className="w-full h-full border-0"
        title={title}
        referrerPolicy="no-referrer"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      />}
    </div>
  );
}
