"use client";

import { useState } from "react";
import Image from "next/image";

export function Artwork({ sources, alt, poster = false }: { sources: (string | undefined)[]; alt: string; poster?: boolean }) {
  const candidates = [...new Set(sources.filter((src): src is string => Boolean(src && src !== "/file.svg")))];
  const [attempt, setAttempt] = useState(0);
  return candidates[attempt] ? <Image src={candidates[attempt]} alt={alt} fill sizes={poster ? "(max-width: 640px) 65vw, 300px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"} className="object-cover" priority={poster} onError={() => setAttempt(value => value + 1)} /> : <div role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className="absolute inset-0 surface flex flex-col items-center justify-center gap-2 p-4 text-secondary"><span aria-hidden="true" className="text-3xl font-semibold opacity-40">{alt.split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</span><span className="text-xs">Artwork unavailable</span></div>;
}

