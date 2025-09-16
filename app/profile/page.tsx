"use client";

import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProfileRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Redirect to user's UID-based profile
        router.replace(`/profile/${user.uid}`);
      } else {
        // Not logged in, redirect to login
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="max-w-4xl mx-auto py-20 text-center">
      <div className="animate-pulse">Redirecting...</div>
    </div>
  );
}
