"use client";

import { useId, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Info, Users, Film } from 'lucide-react';
import { Artwork } from './Artwork';
import type { DramaCast, DramaTrailer } from '@/lib/api-types';

const pageSize = 6;
export function DramaMedia({ cast, trailer, facts = [] }: { cast: DramaCast[]; trailer?: DramaTrailer; facts?: [string, unknown][] }) {
  const hasTrailer = Boolean(trailer && /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}$/.test(trailer.embedUrl));
  const [tab, setTab] = useState('info');
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const id = useId();
  const last = Math.max(0, Math.ceil(cast.length / pageSize) - 1);
  const current = Math.min(page, last);
  const tabs = hasTrailer ? ['info', 'cast', 'trailer'] : ['info', 'cast'];
  const labels: Record<string,string> = {info:'Show info',cast:'Cast',trailer:'Trailer'};
  const icons = {info:Info,cast:Users,trailer:Film};
  return <section className="drama-media" aria-label="Drama information">
    <div className="drama-media-tabs" role="tablist" aria-label="Drama media">
      {tabs.map(name => <button key={name} type="button" id={`${id}-${name}`} role="tab" aria-selected={tab === name} aria-controls={`${id}-panel-${name}`} tabIndex={tab === name ? 0 : -1} onClick={() => { setTab(name); setPlaying(false); }} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = tabs.indexOf(name);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        setTab(tabs[next]); setPlaying(false);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }}>{(() => { const Icon=icons[name as keyof typeof icons]; return <><Icon size={16} aria-hidden="true"/>{labels[name]}</>; })()}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel-${tab}`} aria-labelledby={`${id}-${tab}`} className="pt-5">
      {tab === 'info' ? <section aria-label="Show info"><h2 className="sr-only">Show info</h2><dl className="show-info-grid">{facts.map(([key,value])=><div key={key}><dt className="text-xs text-secondary mb-1.5">{key.replaceAll('_',' ')}</dt><dd className="text-sm text-primary font-medium break-words">{String(value)}</dd></div>)}</dl>{!facts.length && <p className="text-sm text-secondary">Show information is not available yet.</p>}</section> : tab === 'cast' ? <>
        <h2 className="sr-only">Cast</h2>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">{cast.slice(current * pageSize, (current + 1) * pageSize).map(person => <article key={person.name + person.character} className="flex gap-3 items-center min-w-0">
          <div className="relative w-14 aspect-[2/3] shrink-0 rounded-md overflow-hidden surface"><Artwork sources={[person.image]} alt={person.name} person={person.name} personKey={person.portraitKey}/></div>
          <div className="min-w-0"><h3 className="text-sm font-medium text-primary">{person.name}</h3>{person.character && <p className="text-xs text-secondary mt-1">as {person.character}</p>}</div>
        </article>)}</div>
        {!cast.length && <p className="text-sm text-secondary">Cast details are not available yet.</p>}
        {cast.length > pageSize && <nav aria-label="Cast pages" className="flex justify-between items-center gap-3 mt-5 text-xs text-secondary">
          <span role="status">{current * pageSize + 1}–{Math.min((current + 1) * pageSize, cast.length)} of {cast.length}</span>
          <div className="flex gap-2"><button type="button" aria-label="Previous cast page" className="episode-icon-button" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={16}/></button><button type="button" aria-label="Next cast page" className="episode-icon-button" disabled={current === last} onClick={() => setPage(current + 1)}><ChevronRight size={16}/></button></div>
        </nav>}
      </> : trailer && <div className="relative aspect-video overflow-hidden rounded-xl glass-card">
        {playing ? <iframe title={trailer.title || 'Official trailer'} src={`${trailer.embedUrl}?autoplay=1&rel=0`} className="absolute inset-0 w-full h-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/> : <button type="button" className="absolute inset-0 w-full h-full group cursor-pointer" onClick={() => setPlaying(true)} aria-label="Play official trailer">
          <Artwork sources={[trailer.thumbnail]} alt={trailer.title || 'Official trailer'}/><span className="absolute inset-0 bg-black/30"/>
          <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-white/95 text-black p-4 shadow-lg group-hover:scale-105 transition-transform"><Play size={26} fill="currentColor" aria-hidden="true"/></span></span>
        </button>}
      </div>}
    </div>
  </section>;
}
