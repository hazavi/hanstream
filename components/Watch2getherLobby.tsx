"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  createWatch2getherRoom,
  joinWatch2getherRoom,
  getActiveRooms,
  Watch2getherRoom,
} from "@/lib/watch2gether";
import Image from "next/image";
import Link from "next/link";

interface Watch2getherLobbyProps {
  onJoinRoom: (roomId: string) => void;
}

export function Watch2getherLobby({ onJoinRoom }: Watch2getherLobbyProps) {
  const { user } = useAuth();
  const [activeRooms, setActiveRooms] = useState<Watch2getherRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActiveRooms();
    const interval = setInterval(loadActiveRooms, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadActiveRooms = async () => {
    try {
      const rooms = await getActiveRooms();
      // Filter out full rooms and sort by creation time
      const availableRooms = rooms
        .filter((room) => {
          const participantCount = Object.keys(room.participants || {}).length;
          return participantCount < room.maxParticipants;
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      setActiveRooms(availableRooms);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load rooms:", err);
      // Show user-friendly error message
      if (
        err?.message?.includes("Firebase not configured") ||
        err?.message?.includes("Permission denied")
      ) {
        setError(
          "Watch2gether is not yet configured. Please check back later!"
        );
      } else {
        setError("Failed to load active rooms. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!user) {
      setError("Please sign in to join a room");
      return;
    }

    try {
      setError(null);
      const displayName =
        user.displayName || user.email?.split("@")[0] || "Anonymous";
      await joinWatch2getherRoom(roomId, user.uid, displayName);
      onJoinRoom(roomId);
    } catch (err) {
      console.error("Failed to join room:", err);
      setError(err instanceof Error ? err.message : "Failed to join room");
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6 text-center">
        <div className="flex justify-center mb-4">
          <Image
            src="/stream.png"
            alt="Watch2gether"
            width={80}
            height={80}
            className="rounded-2xl"
          />
        </div>
        <h1 className="text-3xl font-bold heading mb-2">Watch2gether</h1>
        <p className="text-secondary max-w-2xl mx-auto">
          Watch K-dramas together in real-time with friends! Join an existing
          room or create your own from any episode page.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="glass-card p-4 border-2 border-red-500/50 bg-red-500/10">
          <p className="text-red-500 text-center">{error}</p>
        </div>
      )}

      {/* Firebase Setup Notice - Only show if there's a permission error */}
      {error && error.includes("not yet configured") && (
        <div className="glass-card p-6 border-2 border-yellow-500/50 bg-yellow-500/10">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="font-bold text-yellow-600 dark:text-yellow-500 mb-2">
                Firebase Setup Required
              </h3>
              <p className="text-sm text-secondary mb-3">
                Watch2gether requires Firebase Realtime Database. Quick setup:
              </p>
              <ol className="text-sm text-secondary space-y-2 list-decimal list-inside">
                <li>Go to Firebase Console → Realtime Database</li>
                <li>Create database in Test Mode</li>
                <li>
                  Set rules to:{" "}
                  <code className="px-1.5 py-0.5 rounded bg-surface text-xs">
                    &#123;"rules":&#123;"watch2gether":&#123;".read":true,".write":"auth!=null"&#125;&#125;&#125;
                  </code>
                </li>
                <li>
                  Add database URL to{" "}
                  <code className="px-1.5 py-0.5 rounded bg-surface text-xs">
                    .env.local
                  </code>
                </li>
              </ol>
              <p className="text-xs text-secondary mt-3">
                See{" "}
                <code className="px-1.5 py-0.5 rounded bg-surface">
                  FIREBASE_SETUP.md
                </code>{" "}
                for detailed instructions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* How to Create a Room */}
      {!error && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold heading mb-4">
            How to Start Watching Together
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <span className="text-accent font-bold">1</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Pick an Episode</h3>
                <p className="text-sm text-secondary">
                  Navigate to any episode page and look for the "Watch Together"
                  button
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <span className="text-accent font-bold">2</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Create a Room</h3>
                <p className="text-sm text-secondary">
                  Click the button to create a new room and share the link with
                  friends
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <span className="text-accent font-bold">3</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Watch Together</h3>
                <p className="text-sm text-secondary">
                  Coordinate playback with friends - best with voice/text chat!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Rooms */}
      <div>
        <h2 className="text-2xl font-bold heading mb-4">
          Active Rooms ({activeRooms.length})
        </h2>

        {activeRooms.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="text-xl font-semibold mb-2">No Active Rooms</h3>
            <p className="text-secondary mb-4">
              Be the first to create a watch party! Head to any episode and
              start a room.
            </p>
            <Link href="/" className="glass-btn inline-block">
              Browse Dramas
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRooms.map((room) => {
              const participantCount = Object.keys(
                room.participants || {}
              ).length;
              return (
                <div
                  key={room.id}
                  className="glass-card p-4 hover:ring-2 hover:ring-accent/50 transition-all"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Image
                      src="/stream.png"
                      alt="Watch2gether"
                      width={48}
                      height={48}
                      className="rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{room.dramaTitle}</h3>
                      <p className="text-sm text-secondary">
                        Episode {room.episode}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <svg
                        className="w-4 h-4 text-accent"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                      </svg>
                      <span>Host: {room.hostName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <svg
                        className="w-4 h-4 text-accent"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      <span>
                        {participantCount}/{room.maxParticipants} watching
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-secondary">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Created {formatTimeAgo(room.createdAt)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinRoom(room.id)}
                    disabled={!user}
                    className="w-full glass-btn hover:bg-accent hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {user ? "Join Room" : "Sign in to Join"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
