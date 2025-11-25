"use client";

import { useEffect, useRef } from "react";

interface SyncedVideoPlayerProps {
  videoUrl: string;
  roomId: string;
  isHost: boolean;
  isPlaying: boolean;
  currentTime: number;
  onPlayStateChange?: (isPlaying: boolean, time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
}

export function SyncedVideoPlayer({ videoUrl }: SyncedVideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="relative">
      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-900 shadow-2xl">
        <iframe
          ref={iframeRef}
          src={videoUrl}
          allowFullScreen
          className="w-full h-full border-0"
          referrerPolicy="no-referrer"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        />
      </div>
    </div>
  );
}
