"use client";
import { Circle, CircleCheck } from 'lucide-react';
import { canonicalEpisode, useEpisodeHistory } from '@/lib/profile';
import { formatEpisodeLabel } from '@/lib/format';
import { Button } from '@/components/ui/button';

export function EpisodeWatchedButton({slug,episode,compact=false}:{slug:string;episode:string;compact?:boolean}) {
  const history=useEpisodeHistory(slug),watched=history.watched.includes(canonicalEpisode(episode));
  const Icon=watched?CircleCheck:Circle;
  return <Button type="button" variant="ghost" size={compact?'icon':'sm'} disabled={!history.ready} aria-pressed={watched} aria-label={`Mark ${formatEpisodeLabel(episode)} as ${watched?'unwatched':'watched'}`} title={watched?'Watched, click to mark unwatched':'Mark as watched'} className={`episode-watched-button ${compact?'h-7 w-7 shrink-0':'h-8 text-xs gap-2'} ${watched?'is-watched':''}`} onClick={()=>void history.setWatched(episode,!watched)}><Icon size={compact?16:14} aria-hidden="true"/>{!compact&&(watched?'Watched':'Mark watched')}</Button>;
}
