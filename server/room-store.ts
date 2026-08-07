import { randomUUID } from 'node:crypto';

export interface DemoRoom {
  documentId: string;
  sourceRoomId: string;
  targetRoomId: string | null;
  pendingTargetRoomId: string | null;
  status: 'editing-v1' | 'migrating' | 'seeding-v2' | 'migrated';
  routingVersion: number;
  migrationError: string | null;
  migrationDocx: Uint8Array | null;
}

const rooms = new Map<string, DemoRoom>();

// Creates and stores a new in-memory room record for the demo.
export function createDemoRoom(documentId = randomUUID().slice(0, 8)): DemoRoom {
  const room: DemoRoom = {
    documentId,
    sourceRoomId: `${documentId}-v1`,
    targetRoomId: null,
    pendingTargetRoomId: null,
    status: 'editing-v1',
    routingVersion: 0,
    migrationError: null,
    migrationDocx: null,
  };
  rooms.set(documentId, room);
  return room;
}

// Returns an in-memory room by its public document identifier.
export const getDemoRoom = (documentId: string) => rooms.get(documentId);

// Removes internal migration fields before returning a room to the client.
export function publicRoom(room: DemoRoom) {
  return {
    documentId: room.documentId,
    sourceRoomId: room.sourceRoomId,
    targetRoomId: room.targetRoomId ?? room.pendingTargetRoomId,
    status: room.status,
    migrationError: room.migrationError,
    v1Archived: room.status === 'migrated',
  };
}
