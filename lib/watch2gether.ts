import { database } from './firebase';
import { ref, set, onValue, update, remove, get, push, serverTimestamp } from 'firebase/database';

export interface Watch2getherRoom {
  id: string;
  hostId: string;
  hostName: string;
  slug: string;
  episode: string;
  dramaTitle: string;
  videoUrl: string;
  isPlaying: boolean;
  currentTime: number;
  participants: {
    [userId: string]: {
      displayName: string;
      joinedAt: number;
      lastSeen: number;
    };
  };
  chat: {
    [messageId: string]: {
      userId: string;
      displayName: string;
      message: string;
      timestamp: number;
    };
  };
  createdAt: number;
  maxParticipants: number;
}

export interface Watch2getherMessage {
  userId: string;
  displayName: string;
  message: string;
  timestamp: number;
}

// Create a new watch together room
export async function createWatch2getherRoom(
  hostId: string,
  hostName: string,
  slug: string,
  episode: string,
  dramaTitle: string,
  videoUrl: string
): Promise<string> {
  if (!database) {
    throw new Error('Firebase not configured. Please set up Firebase to use Watch2gether.');
  }

  const roomsRef = ref(database, 'watch2gether/rooms');
  const newRoomRef = push(roomsRef);
  const roomId = newRoomRef.key!;

  const room: Watch2getherRoom = {
    id: roomId,
    hostId,
    hostName,
    slug,
    episode,
    dramaTitle,
    videoUrl,
    isPlaying: false,
    currentTime: 0,
    participants: {
      [hostId]: {
        displayName: hostName,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      },
    },
    chat: {},
    createdAt: Date.now(),
    maxParticipants: 50,
  };

  try {
    await set(newRoomRef, room);
    return roomId;
  } catch (error: any) {
    if (error?.code === 'PERMISSION_DENIED' || error?.message?.includes('Permission denied')) {
      throw new Error('Permission denied. Please check Firebase security rules are configured correctly.');
    }
    throw error;
  }
}

// Join an existing room
export async function joinWatch2getherRoom(
  roomId: string,
  userId: string,
  displayName: string
): Promise<boolean> {
  if (!database) {
    throw new Error('Firebase not configured. Please set up Firebase to use Watch2gether.');
  }

  const roomRef = ref(database, `watch2gether/rooms/${roomId}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    throw new Error('Room not found');
  }

  const room = snapshot.val() as Watch2getherRoom;
  const participantCount = Object.keys(room.participants || {}).length;

  if (participantCount >= room.maxParticipants) {
    throw new Error('Room is full');
  }

  await update(roomRef, {
    [`participants/${userId}`]: {
      displayName,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    },
  });

  return true;
}

// Leave a room
export async function leaveWatch2getherRoom(roomId: string, userId: string): Promise<void> {
  if (!database) {
    console.warn('Firebase not configured');
    return;
  }

  try {
    const participantRef = ref(database, `watch2gether/rooms/${roomId}/participants/${userId}`);
    await remove(participantRef);

    // Check if room is empty and delete if so
    const roomRef = ref(database, `watch2gether/rooms/${roomId}`);
    const snapshot = await get(roomRef);

    if (snapshot.exists()) {
      const room = snapshot.val() as Watch2getherRoom;
      const participantCount = Object.keys(room.participants || {}).length;

      if (participantCount === 0) {
        await remove(roomRef);
      }
    }
  } catch (error) {
    // Silent fail - non-critical
  }
}

// Update video state (play/pause/seek)
export async function updateVideoState(
  roomId: string,
  isPlaying: boolean,
  currentTime: number
): Promise<void> {
  if (!database) {
    return;
  }

  try {
    const roomRef = ref(database, `watch2gether/rooms/${roomId}`);
    await update(roomRef, {
      isPlaying,
      currentTime,
      lastUpdated: Date.now(),
    });
  } catch (error) {
    // Silent fail - non-critical
  }
}

// Send a chat message
export async function sendChatMessage(
  roomId: string,
  userId: string,
  displayName: string,
  message: string
): Promise<void> {
  if (!database) {
    return;
  }

  try {
    const chatRef = ref(database, `watch2gether/rooms/${roomId}/chat`);
    const newMessageRef = push(chatRef);

    await set(newMessageRef, {
      userId,
      displayName,
      message,
      timestamp: Date.now(),
    });
  } catch (error) {
    throw error;
  }
}

// Subscribe to room updates
export function subscribeToRoom(
  roomId: string,
  callback: (room: Watch2getherRoom | null) => void
): () => void {
  if (!database) {
    callback(null);
    return () => {};
  }

  try {
    const roomRef = ref(database, `watch2gether/rooms/${roomId}`);
    const unsubscribe = onValue(
      roomRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.val() as Watch2getherRoom);
        } else {
          callback(null);
        }
      },
      (error) => {
        callback(null);
      }
    );

    return unsubscribe;
  } catch (error) {
    callback(null);
    return () => {};
  }
}

// Get all active rooms
export async function getActiveRooms(): Promise<Watch2getherRoom[]> {
  if (!database) {
    return [];
  }

  try {
    const roomsRef = ref(database, 'watch2gether/rooms');
    const snapshot = await get(roomsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const rooms = snapshot.val();
    return Object.values(rooms) as Watch2getherRoom[];
  } catch (error: any) {
    if (error?.code === 'PERMISSION_DENIED' || error?.message?.includes('Permission denied')) {
      return [];
    }
    throw error;
  }
}

// Update user's last seen timestamp
export async function updateLastSeen(roomId: string, userId: string): Promise<void> {
  if (!database) {
    return; // Silently return if Firebase not configured
  }

  try {
    const participantRef = ref(database, `watch2gether/rooms/${roomId}/participants/${userId}/lastSeen`);
    await set(participantRef, Date.now());
  } catch (error) {
    // Silently fail - non-critical
  }
}
