import type { RoomContext } from './helpers.js';

export async function activateRouting(context: RoomContext) {
  if (context.room.targetRoomId === context.targetRoomId) return;
  if (context.room.targetRoomId !== null) throw new Error('another target is already active');
  context.room.targetRoomId = context.targetRoomId;
  context.room.pendingTargetRoomId = null;
  context.room.routingVersion += 1;
}

export async function verifyArchive(context: RoomContext) {
  if (context.room.targetRoomId !== context.targetRoomId) throw new Error('routing does not point to the target');
  context.room.status = 'migrated';
}
