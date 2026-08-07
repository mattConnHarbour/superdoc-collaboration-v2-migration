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

export const getDemoRoom = (documentId: string) => rooms.get(documentId);

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
