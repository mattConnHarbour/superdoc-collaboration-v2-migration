import type { DemoRoom } from '../room-store.js';

export interface RoomContext {
  room: DemoRoom;
  collaborationUrl: string;
  broadcastViewOnly: (roomId: string) => void;
  closeWriters: () => void;
  targetRoomId: string;
  docxBackup?: Uint8Array;
}

export function createRoomContext(
  room: DemoRoom,
  collaborationUrl: string,
  broadcastViewOnly: (roomId: string) => void,
  closeWriters: () => void,
): RoomContext {
  return {
    room,
    collaborationUrl,
    broadcastViewOnly,
    closeWriters,
    targetRoomId: `${room.documentId}-v2`,
  };
}
