"use client";

import Link from "next/link";
import { useProfile } from "@/lib/profile";
import { BookOpen } from 'lucide-react';

export function AuthStatus() {
  const { profile } = useProfile();
  return <Link href="/profile" className="glass-btn library-link" aria-label="My library">
    <BookOpen size={17} aria-hidden="true"/>
    <span className="library-label">My Library</span>
    {!!profile?.watchlist.length && <span className="library-count">{profile.watchlist.length}</span>}
  </Link>;
}

export default AuthStatus;
