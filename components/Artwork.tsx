"use client";

import { useState } from "react";
import Image from "next/image";
import { UserRound } from 'lucide-react';
import { isPublishedImage } from '@/lib/image-utils.mjs';

export function Artwork({ sources, alt, poster = false, placeholder = 'Artwork unavailable', title, year, person, personKey, fallbackLabel }: { sources: (string | undefined)[]; alt: string; poster?: boolean; placeholder?: string; title?: string; year?: number; person?: string; personKey?: string; fallbackLabel?: string }) {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  const fallback = title ? `${base}/api/artwork?${new URLSearchParams({ title, ...(year ? { year: String(year) } : {}) })}` : undefined;
  const portrait = person ? `${base}/api/portrait?${new URLSearchParams({ name: person, ...(personKey ? {key:personKey} : {}) })}` : undefined;
  const candidates = [...new Set([...sources, portrait, fallback, fallback ? `${fallback}&secondary=1` : undefined].filter((src): src is string => isPublishedImage(src)))];
  const [failure, setFailure] = useState({ key: '', attempt: 0 });
  const key = candidates.join('|');
  const attempt = failure.key === key ? failure.attempt : 0;
  return candidates[attempt] ? <Image src={candidates[attempt]} alt={alt} fill sizes={person ? "64px" : poster ? "(max-width: 640px) 65vw, 300px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"} className="object-cover" priority={poster} onError={() => setFailure({ key, attempt: attempt + 1 })} /> : <div role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className="absolute inset-0 surface flex flex-col items-center justify-center gap-2 p-2 text-secondary">{person ? <UserRound size={24} aria-hidden="true" className="opacity-40"/> : <>{(alt || fallbackLabel) && <span aria-hidden="true" className="text-3xl font-semibold opacity-40">{fallbackLabel ?? alt.split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</span>}<span className="text-xs">{placeholder}</span></>}</div>;
}
