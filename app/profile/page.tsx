"use client";

import Link from "next/link";
import Image from "next/image";
import { useProfile } from "@/lib/profile";

export default function ProfilePage() {
  const { profile, removeFromWatchlist } = useProfile();
  return <main className="mx-auto max-w-6xl space-y-8">
    <div className="glass-card p-6 sm:p-8">
      <h1 className="heading text-3xl">My Library</h1>
      <p className="text-secondary mt-2">Saved on this device. Your watchlist and progress stay in this browser.</p>
    </div>
    <section className="space-y-4">
      <h2 className="heading text-2xl">Watchlist</h2>
      {!profile?.watchlist.length && <p className="glass-card p-6 text-secondary">Save a drama to see it here.</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {profile?.watchlist.map((item) => <div key={item.slug} className="glass-card overflow-hidden p-2">
          <Link href={`/${item.slug}`} className="block">
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-white/20">{item.image && <Image src={item.image} alt={item.title} fill className="object-cover" />}</div>
            <h3 className="mt-3 truncate font-semibold">{item.title}</h3>
          </Link>
          <p className="text-secondary text-sm capitalize">{item.status.replaceAll("-", " ")}{item.rating ? ` · ${item.rating}/10` : ""}</p>
          <button type="button" onClick={() => removeFromWatchlist(item.slug)} className="mt-2 text-xs text-secondary underline">Remove</button>
        </div>)}
      </div>
    </section>
    <section className="space-y-4">
      <h2 className="heading text-2xl">Continue watching</h2>
      {!profile?.continueWatching.length && <p className="glass-card p-6 text-secondary">Episodes you visit will appear here.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {profile?.continueWatching.map((item) => <Link key={item.slug} href={`/${item.slug}/episode/${item.episodeRoute || item.currentEpisode}`} className="glass-card p-4 font-semibold">{item.title} · Episode {item.currentEpisode}</Link>)}
      </div>
    </section>
  </main>;
}
