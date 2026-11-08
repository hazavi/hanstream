"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Folder, Trash2 } from 'lucide-react';
import { useProfile } from '@/lib/profile';
import type { WatchlistItem, WatchStatus } from '@/lib/types';
import { Artwork } from './Artwork';
import { ConfirmationModal } from './ConfirmationModal';

const statuses: {status: WatchStatus; label: string}[] = [
  {status: 'watching', label: 'Watching'},
  {status: 'paused', label: 'Paused'},
  {status: 'plan-to-watch', label: 'Plan to watch'},
  {status: 'finished', label: 'Finished'},
  {status: 'dropped', label: 'Dropped'},
];
const countLabel = (count: number) => `${count} ${count === 1 ? 'drama' : 'dramas'}`;

export function WatchlistFolders() {
  const {profile, removeFromWatchlist} = useProfile();
  const [selected, setSelected] = useState<WatchStatus | null>(null);
  const [page, setPage] = useState(1);
  const [pendingRemoval, setPendingRemoval] = useState<WatchlistItem | null>(null);
  const folders = useMemo(() => statuses.map(folder => ({...folder,
    items: profile?.watchlist.filter(item => item.status === folder.status) || [],
  })), [profile?.watchlist]);
  const folder = folders.find(item => item.status === selected);
  const pages = Math.max(1, Math.ceil((folder?.items.length || 0) / 20));
  const current = Math.min(page, pages);
  useEffect(() => { setPage(value => Math.min(value, pages)); }, [pages]);

  return <section className="space-y-5 min-w-0" aria-labelledby="watchlist-heading">
    <h2 id="watchlist-heading" className="heading text-2xl">Watchlist</h2>
    {!folder ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {folders.map(({status, label, items}) => <button
        key={status} type="button" className="library-folder glass-card"
        aria-label={`Open ${label} folder`} aria-describedby={`folder-count-${status}`}
        onClick={() => { setPage(1); setSelected(status); }}
      >
        <div className="flex items-start justify-between gap-3">
          <Folder size={32} strokeWidth={1.5} aria-hidden="true" />
          <ArrowUpRight size={16} className="text-secondary" aria-hidden="true" />
        </div>
        <span className="mt-5 block font-semibold">{label}</span>
        <span id={`folder-count-${status}`} className="mt-1 block text-sm text-secondary">{countLabel(items.length)}</span>
      </button>)}
    </div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="glass-btn gap-2 px-4" onClick={() => setSelected(null)} aria-label="Back to folders">
          <ArrowLeft size={16} aria-hidden="true" />All folders
        </button>
        <div className="flex items-baseline gap-3"><h3 className="heading text-lg">{folder.label}</h3><p className="text-sm text-secondary" role="status">{countLabel(folder.items.length)}</p></div>
      </div>
      {!folder.items.length ? <p className="glass-card p-6 text-secondary">No dramas in {folder.label.toLowerCase()} yet.</p> :
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {folder.items.slice((current - 1) * 20,current * 20).map(item => <article key={item.slug} className="library-card glass-card relative overflow-hidden p-2">
            <Link href={`/${item.slug}`} className="block rounded-lg" aria-label={item.title}>
              <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
                <Artwork sources={[item.image]} alt={`${item.title} poster`} title={item.title} poster />
              </div>
              <h4 className="mt-3 truncate font-semibold" title={item.title}>{item.title}</h4>
            </Link>
            <p className="mt-1 text-secondary text-sm">{folder.label}{item.rating ? ` · ${item.rating}/10` : ''}</p>
            <button type="button" className="library-remove danger-button" aria-label={`Remove ${item.title} from watchlist`} title="Remove from watchlist" onClick={() => setPendingRemoval(item)}>
              <Trash2 size={17} aria-hidden="true" />
            </button>
          </article>)}
        </div>}
      {folder.items.length > 20 && <nav aria-label="Watchlist pagination" className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="glass-btn gap-2 px-4" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft size={16} aria-hidden="true"/>Previous</button>
        <p className="text-sm text-secondary" role="status">Page {current} of {pages} · Showing {(current - 1) * 20 + 1}–{Math.min(current * 20,folder.items.length)} of {folder.items.length}</p>
        <button type="button" className="glass-btn gap-2 px-4" disabled={current === pages} onClick={() => setPage(current + 1)}>Next<ChevronRight size={16} aria-hidden="true"/></button>
      </nav>}
    </>}
    <ConfirmationModal isOpen={pendingRemoval !== null} onClose={() => setPendingRemoval(null)}
      onConfirm={() => { if (pendingRemoval) void removeFromWatchlist(pendingRemoval.slug); }}
      title="Remove from watchlist?" message={`Remove "${pendingRemoval?.title || ''}" from your watchlist? Your watch history will stay saved.`}
      confirmText="Remove drama" variant="danger" />
  </section>;
}
