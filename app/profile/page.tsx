"use client";

import Link from "next/link";
import { useProfile } from "@/lib/profile";
import { ProfileTransfer } from '@/components/ProfileTransfer';
import { DesktopUpdates } from '@/components/DesktopUpdates';
import { PageSkeleton } from '@/components/PageSkeleton';
import { WatchlistFolders } from '@/components/WatchlistFolders';

export default function ProfilePage() {
  const { profile } = useProfile();
  if (!profile) return <PageSkeleton view="profile" />;
  return <main className="mx-auto max-w-6xl space-y-8">
    <div className="glass-card p-6 sm:p-8">
      <h1 className="heading text-3xl">My Library</h1>
      <p className="text-secondary mt-2">Saved on this device. Your watchlist and progress stay in this app or browser.</p>
    </div>
    <ProfileTransfer />
    <DesktopUpdates />
    <WatchlistFolders />
    <section className="space-y-4">
      <h2 className="heading text-2xl">Continue watching</h2>
      {!profile?.continueWatching.length && <p className="glass-card p-6 text-secondary">Episodes you visit will appear here.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {profile?.continueWatching.map((item) => <Link key={item.slug} href={`/${item.slug}/episode/${item.episodeRoute || item.currentEpisode}`} className="glass-card p-4 font-semibold">{item.title} · Episode {item.currentEpisode}</Link>)}
      </div>
    </section>
  </main>;
}
