"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  subscribeToRoom,
  updateVideoState,
  updateLastSeen,
  leaveWatch2getherRoom,
  Watch2getherRoom,
} from "@/lib/watch2gether";
import { SyncedVideoPlayer } from "./SyncedVideoPlayer";
import Link from "next/link";
import Image from "next/image";

interface Watch2getherPlayerProps {
  roomId: string;
  onLeave: () => void;
}

export function Watch2getherPlayer({
  roomId,
  onLeave,
}: Watch2getherPlayerProps) {
  const { user } = useAuth();
  const [room, setRoom] = useState<Watch2getherRoom | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(() => {
    // Restore chat state from localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("watch2gether-chat-open");
      return saved ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadTimestamp, setLastReadTimestamp] = useState(Date.now());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [roomUptime, setRoomUptime] = useState("");

  // Subscribe to room updates
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribeToRoom(roomId, (updatedRoom) => {
      if (!updatedRoom) {
        onLeave();
        return;
      }
      setRoom(updatedRoom);
      setIsHost(updatedRoom.hostId === user?.uid);
    });

    return () => {
      unsubscribe();
    };
  }, [roomId, user?.uid, onLeave]);

  // Update last seen
  useEffect(() => {
    if (!roomId || !user?.uid) return;
    const interval = setInterval(() => {
      updateLastSeen(roomId, user.uid);
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId, user?.uid]);

  // Leave room on unmount
  useEffect(() => {
    return () => {
      if (roomId && user?.uid) {
        leaveWatch2getherRoom(roomId, user.uid);
      }
    };
  }, [roomId, user?.uid]);

  // Auto-scroll chat to bottom when new messages arrive (only if user is at bottom)
  useEffect(() => {
    if (shouldAutoScroll) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [room?.chat, shouldAutoScroll]);

  // Handle scroll to detect if user scrolled up
  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;

    setShouldAutoScroll(isAtBottom);
  };

  // Save chat open state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "watch2gether-chat-open",
        JSON.stringify(isChatOpen)
      );
    }

    // Reset unread count when chat is opened
    if (isChatOpen) {
      setUnreadCount(0);
      setLastReadTimestamp(Date.now());
    }
  }, [isChatOpen]);

  // Count unread messages when chat is closed
  useEffect(() => {
    if (!isChatOpen && room?.chat) {
      const messages = Object.values(room.chat);
      const unread = messages.filter(
        (msg) => msg.timestamp > lastReadTimestamp && msg.userId !== user?.uid
      ).length;
      setUnreadCount(unread);
    }
  }, [room?.chat, isChatOpen, lastReadTimestamp, user?.uid]);

  // Calculate room uptime
  useEffect(() => {
    if (!room?.createdAt) return;

    const updateUptime = () => {
      const now = Date.now();
      const diff = now - room.createdAt;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setRoomUptime(`${hours}h ${minutes}m`);
      } else {
        setRoomUptime(`${minutes}m`);
      }
    };

    updateUptime();
    const interval = setInterval(updateUptime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [room?.createdAt]);

  const handleLeave = async () => {
    if (roomId && user?.uid) {
      await leaveWatch2getherRoom(roomId, user.uid);
    }
    onLeave();
  };

  if (!room) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  const participants = Object.entries(room.participants || {});
  const currentEpisodeNum = room.episode;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Watch2gether branding */}
      <div className="glass-card p-3 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
            <Image
              src="/stream.png"
              alt="Watch2gether"
              width={32}
              height={32}
              className="rounded-lg flex-shrink-0 md:w-10 md:h-10"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm md:text-lg heading truncate">
                  {room.dramaTitle}
                </h3>
                <span className="text-sm md:text-base px-3 py-1 rounded-full bg-accent/10 text-accent font-semibold whitespace-nowrap">
                  Ep {room.episode}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-secondary">
                  <svg
                    className="w-3 h-3 md:w-4 md:h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  <span className="font-medium text-xs">
                    {participants.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-secondary">
                  <svg
                    className="w-3 h-3 md:w-4 md:h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-medium text-xs">{roomUptime}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="px-3 py-2 rounded-lg bg-accent/10 hover:cursor-pointer bg-accent/20 text-primary font-medium transition-colors flex items-center gap-2 relative"
              title={isChatOpen ? "Hide chat" : "Show chat"}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="hidden md:inline text-sm">Chat</span>
              {!isChatOpen && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={handleLeave}
              className="px-3 py-2 rounded-lg bg-red-500/10 hover:cursor-pointer bg-red-500/20 text-red-500 font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="hidden sm:inline text-sm">Leave</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Video + Chat */}
      <div className="flex flex-col lg:flex-row gap-3 md:gap-4 items-start">
        {/* Video Player Column */}
        <div
          className={`w-full transition-all duration-300 ${
            isChatOpen ? "lg:flex-1" : "flex-1"
          }`}
        >
          <SyncedVideoPlayer
            key={room.episode}
            videoUrl={room.videoUrl}
            roomId={roomId}
            isHost={isHost}
            isPlaying={room.isPlaying}
            currentTime={room.currentTime}
          />
        </div>

        {/* Chat Sidebar - Toggleable */}
        {isChatOpen && (
          <div className="w-full lg:w-80 flex-shrink-0 self-stretch">
            <section className="glass-card flex flex-col h-full min-h-[400px] lg:min-h-0">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold heading">Chat</h2>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent/10">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium text-accent">
                    {participants.length} online
                  </span>
                </div>
              </div>

              {/* Messages Area */}
              <div
                ref={chatContainerRef}
                onScroll={handleChatScroll}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent hover:scrollbar-thumb-accent/30"
              >
                {room.chat && Object.entries(room.chat).length > 0 ? (
                  <>
                    {Object.entries(room.chat).map(([messageId, msg]) => {
                      const isOwnMessage = msg.userId === user?.uid;
                      return (
                        <div
                          key={messageId}
                          className={`flex flex-col gap-1 ${
                            isOwnMessage ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`flex items-center gap-1.5 ${
                              isOwnMessage ? "flex-row-reverse" : ""
                            }`}
                          >
                            <span
                              className="text-[10px] font-semibold"
                              style={{ color: "var(--primary)" }}
                            >
                              {msg.displayName}
                            </span>
                            <span
                              className="text-[9px]"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div
                            className={`px-3 py-2.5 rounded-xl text-sm max-w-[85%] break-words shadow-sm ${
                              isOwnMessage ? "rounded-br-sm" : "rounded-bl-sm"
                            }`}
                            style={{
                              background: isOwnMessage
                                ? "var(--primary)"
                                : "var(--card)",
                              color: isOwnMessage
                                ? "#ffffff"
                                : "var(--foreground)",
                              border: isOwnMessage
                                ? "none"
                                : "1px solid var(--border)",
                            }}
                          >
                            {msg.message}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <svg
                      className="w-12 h-12 text-secondary/30"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <div className="text-center">
                      <p className="text-sm font-medium text-secondary">
                        No messages yet
                      </p>
                      <p className="text-xs text-secondary/70 mt-1">
                        Start the conversation!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="px-4 py-3 border-t border-white/5 flex-shrink-0">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const input = form.elements.namedItem(
                      "message"
                    ) as HTMLInputElement;
                    const message = input.value.trim();

                    if (!message || !user) {
                      return;
                    }

                    try {
                      const { ref, push } = await import("firebase/database");
                      const { database } = await import("@/lib/firebase");
                      if (!database) return;

                      const chatRef = ref(
                        database,
                        `watch2gether/rooms/${roomId}/chat`
                      );

                      await push(chatRef, {
                        userId: user.uid,
                        displayName: user.displayName || "Anonymous",
                        message,
                        timestamp: Date.now(),
                      });

                      input.value = "";
                    } catch (error) {
                      // Silent fail - error already logged in Firebase lib
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    name="message"
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-surface/50 border border-white/10 focus:border-accent/50 focus:bg-surface focus:outline-none text-sm placeholder:text-secondary/50 transition-all"
                    maxLength={200}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/90 hover:cursor-pointer hover:shadow-lg hover:shadow-accent/25 transition-all flex items-center justify-center group"
                  >
                    <svg
                      className="w-5 h-5 text-white group-hover:scale-110 transition-transform"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                </form>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
