"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { UserRound } from 'lucide-react';
import { isPublishedImage } from '@/lib/image-utils.mjs';
import { artworkFailedRecently, artworkWinner, claimArtworkRetry, failArtwork, rememberArtwork, subscribeArtwork } from '@/lib/artwork-cache';

export function Artwork({ sources, alt, poster = false, placeholder = 'Artwork unavailable', title, year, person, personKey, fallbackLabel }: { sources: (string | undefined)[]; alt: string; poster?: boolean; placeholder?: string; title?: string; year?: number; person?: string; personKey?: string; fallbackLabel?: string }) {
  const loadedSource = useRef<string | undefined>(undefined);
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  const fallback = title ? `${base}/api/artwork?${new URLSearchParams({ title, ...(year ? { year: String(year) } : {}) })}` : undefined;
  const portrait = person ? `${base}/api/portrait?${new URLSearchParams({ name: person, ...(personKey ? {key:personKey} : {}) })}` : undefined;
  const candidates = [...new Set([...sources, portrait, fallback].filter((src): src is string => isPublishedImage(src)))];
  const [failure, setFailure] = useState({ key: '', attempt: 0 });
  const key = JSON.stringify(candidates);
  const attempt = failure.key === key ? failure.attempt : 0;
  const source = candidates[attempt];
  useEffect(() => {
    const items = JSON.parse(key) as string[];
    const restore = () => {
      const winner = artworkWinner(key);
      const index = winner ? items.indexOf(winner) : -1;
      if (index >= 0) setFailure(previous => previous.key===key && previous.attempt===index ? previous : {key,attempt:index});
    };
    restore();
    return subscribeArtwork(key,restore);
  },[key]);
  useEffect(() => {
    if (source || key==='[]') return;
    const timer=setTimeout(()=>{if(claimArtworkRetry(key))setFailure({key,attempt:0});},6000);
    return ()=>clearTimeout(timer);
  },[source,key]);
  useEffect(() => {
    if (!source || !/^https?:/.test(source) || source.startsWith(base + '/api/')) return;
    const timer = setTimeout(() => {
      if (loadedSource.current === source) return;
      failArtwork(key,source);
      setFailure({key,attempt:attempt+1});
    },3500);
    return () => clearTimeout(timer);
  },[source,key,attempt,base]);
  return source ? <Image key={source} src={source} alt={alt} fill sizes={person ? "64px" : poster ? "(max-width: 640px) 65vw, 300px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"} className="object-cover" priority={poster} decoding="async" referrerPolicy="no-referrer" onLoad={() => { loadedSource.current=source; rememberArtwork(key,source); }} onError={() => {
    failArtwork(key,source);
    let next=attempt+1;
    while(next<candidates.length && artworkFailedRecently(candidates[next]))next++;
    setFailure({key,attempt:next});
  }} /> : <div role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className="absolute inset-0 surface flex flex-col items-center justify-center gap-2 p-2 text-secondary">{person ? <UserRound size={24} aria-hidden="true" className="opacity-40"/> : <>{(alt || fallbackLabel) && <span aria-hidden="true" className="text-3xl font-semibold opacity-40">{fallbackLabel ?? alt.split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</span>}<span className="text-xs">{placeholder}</span></>}</div>;
}
