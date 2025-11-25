"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { createWatch2getherRoom } from "@/lib/watch2gether";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface Watch2getherButtonProps {
  slug: string;
  episode: string;
  dramaTitle: string;
  videoUrl: string;
}

export function Watch2getherButton({
  slug,
  episode,
  dramaTitle,
  videoUrl,
}: Watch2getherButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const displayName =
        user.displayName || user.email?.split("@")[0] || "Anonymous";
      const roomId = await createWatch2getherRoom(
        user.uid,
        displayName,
        slug,
        episode,
        dramaTitle,
        videoUrl
      );

      // Redirect to watch2gether page with room ID
      router.push(`/watch2gether?room=${roomId}`);
    } catch (err: any) {
      // Show user-friendly error message
      if (err?.message?.includes("Firebase not configured")) {
        setError(
          "Watch2gether is not yet configured. Please check back later!"
        );
      } else if (err?.message?.includes("Permission denied")) {
        setError(
          "Firebase security rules need to be configured. Please contact the site admin."
        );
      } else {
        setError("Failed to create room. Please try again.");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleCreateRoom}
        disabled={creating}
        className="flex items-center gap-2 hover:cursor-pointer hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <Image
          src="/stream.png"
          alt="Watch2gether"
          width={24}
          height={24}
          className="rounded group-hover:scale-105 transition-transform"
        />
        <span className="text-sm font-medium">
          {creating ? "Creating Room..." : "Watch Together"}
        </span>
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}
