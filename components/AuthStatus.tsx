"use client";
import Link from "next/link";
import React from "react";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";

export function AuthStatus() {
  const { user, loading, signOut } = useAuth();
  const { getDisplayName } = useProfile();

  if (loading) return <div className="px-3">...</div>;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="glass-btn px-3 py-1">
          Sign in
        </Link>
      </div>
    );
  }

  const displayName = getDisplayName();

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/profile/${user.uid}`}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs text-white font-medium">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="hidden sm:inline">{displayName}</span>
      </Link>
      <button onClick={() => signOut()} className="glass-btn px-3 py-1">
        Sign out
      </button>
    </div>
  );
}

export default AuthStatus;
