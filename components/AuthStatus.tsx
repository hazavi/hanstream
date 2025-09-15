"use client";
import Link from "next/link";
import React from "react";
import { useAuth } from "@/lib/auth";

export function AuthStatus() {
  const { user, loading, signOut } = useAuth();

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

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {user.email}
      </span>
      <button onClick={() => signOut()} className="glass-btn px-3 py-1">
        Sign out
      </button>
    </div>
  );
}

export default AuthStatus;
