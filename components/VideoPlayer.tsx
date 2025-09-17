"use client";

interface VideoPlayerProps {
  src: string;
  title: string;
  currentEpisode: string;
}

export function VideoPlayer({ src, title }: VideoPlayerProps) {
  return (
    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-900 shadow-2xl">
      <iframe
        src={src}
        allowFullScreen
        className="w-full h-full border-0"
        title={title}
      />
    </div>
  );
}
