"use client";

import { useRef } from "react";

interface VideoPlayerProps {
  src: string;
  title: string;
  currentEpisode: string;
}

export function VideoPlayer({ src, title }: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-900 shadow-2xl relative">
      <iframe
        ref={iframeRef}
        src={src}
        allowFullScreen
        className="w-full h-full border-0"
        title={title}
        referrerPolicy="no-referrer"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      />
    </div>
  );
}
