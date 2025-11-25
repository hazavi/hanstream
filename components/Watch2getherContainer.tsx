"use client";

import { useState, useEffect } from "react";
import { Watch2getherLobby } from "./Watch2getherLobby";
import { Watch2getherPlayer } from "./Watch2getherPlayer";

interface Watch2getherContainerProps {
  initialRoomId?: string | null;
}

export function Watch2getherContainer({
  initialRoomId,
}: Watch2getherContainerProps) {
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(
    initialRoomId || null
  );

  useEffect(() => {
    if (initialRoomId) {
      setCurrentRoomId(initialRoomId);
    }
  }, [initialRoomId]);

  const handleJoinRoom = (roomId: string) => {
    setCurrentRoomId(roomId);
    // Update URL without page reload
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", `/watch2gether?room=${roomId}`);
    }
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
    // Update URL without page reload
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/watch2gether");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {currentRoomId ? (
        <Watch2getherPlayer roomId={currentRoomId} onLeave={handleLeaveRoom} />
      ) : (
        <Watch2getherLobby onJoinRoom={handleJoinRoom} />
      )}
    </div>
  );
}
