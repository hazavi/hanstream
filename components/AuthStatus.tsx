"use client";

import Link from "next/link";
import { useProfile } from "@/lib/profile";

export function AuthStatus() {
  const { profile } = useProfile();
  return <Link href="/profile" className="glass-btn px-3 py-1" aria-label="My library">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/></svg>
    <span className="hidden sm:inline">My Library</span>
    {!!profile?.watchlist.length && <span className="text-xs opacity-70">{profile.watchlist.length}</span>}
  </Link>;
}

export default AuthStatus;
