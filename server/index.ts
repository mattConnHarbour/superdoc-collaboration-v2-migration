import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from '@hocuspocus/server';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { createRoomContext, RoomMigrationService } from './room-migration-service.js';
import { registerRoomRoutes } from './routes.js';
import { getDemoRoom } from './room-store.js';

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 3101);
const COLLAB_URL = process.env.COLLAB_URL ?? `ws://127.0.0.1:${PORT}`;
const snapshots = new Map<string, Uint8Array>();
const knownDocumentIds = new Set<string>();
const pendingMigrations = new Map<string, ReturnType<typeof createRoomContext>>();

const collaboration = Server.configure({
  yDocOptions: { gc: false, gcFilter: () => true },
  debounce: 100,
  maxDebounce: 500,
  // Prevents writes when a client connects to an archived V1 room.
  async onConnect({ documentName, connection }) {
    const room = [...roomsForLookup()].find((candidate) => candidate.sourceRoomId === documentName);
    if (room && room.status !== 'editing-v1') {
      connection.readOnly = true;
    }
  },
  // Restores frozen-room UI state for a client that connects through a V1 URL.
  async connected({ documentName, connectionInstance }) {
    const room = [...roomsForLookup()].find((candidate) => candidate.sourceRoomId === documentName);
    if (room && room.status !== 'editing-v1') {
      connectionInstance.sendStateless('{"type":"room-view-only"}');
      if (room.status === 'migrated' && room.targetRoomId) {
        connectionInstance.sendStateless(JSON.stringify({
          type: 'room-migration-ready',
          targetRoomId: room.targetRoomId,
        }));
      }
    }
  },
  // Restores the latest in-memory Yjs snapshot when a V1 room is opened.
  async onLoadDocument({ documentName, document }) {
    if (documentName.startsWith('sd2/v2.1/')) return document;
    const update = snapshots.get(documentName);
    if (update) Y.applyUpdate(document, update);
    return document;
  },
  // Captures each changed V1 room as an in-memory Yjs update.
  async onChange({ documentName, document }) {
    if (documentName.startsWith('sd2/v2.1/')) return;
    snapshots.set(documentName, Y.encodeStateAsUpdate(document));
  },
  // Captures a final V1 snapshot before the last connection releases a room.
  async onStoreDocument({ documentName, document }) {
    if (documentName.startsWith('sd2/v2.1/')) return;
    snapshots.set(documentName, Y.encodeStateAsUpdate(document));
  },
});

const liveV2Rooms = new Map<string, Awaited<ReturnType<typeof collaboration.openDirectConnection>>>();

// Keeps a seeded V2 document resident so future clients join the existing room.
async function keepV2RoomAlive(roomId: string) {
  if (liveV2Rooms.has(roomId)) return;
  const roomName = `sd2/v2.1/${roomId}`;
  liveV2Rooms.set(roomId, await collaboration.openDirectConnection(roomName));
}

// Iterates over room records known to the collaboration server.
function* roomsForLookup() {
  for (const documentId of knownDocumentIds) {
    const room = getDemoRoom(documentId);
    if (room) yield room;
  }
}

const migration = new RoomMigrationService();

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
app.get('/health', async () => ({ ok: true }));
registerRoomRoutes(app, {
  collaboration,
  collaborationUrl: COLLAB_URL,
  migration,
  knownDocumentIds,
  pendingMigrations,
  keepV2RoomAlive,
});

const webSockets = new WebSocketServer({ server: app.server });
webSockets.on('connection', (socket, request) => {
  socket.on('error', (error) => app.log.error(error));
  collaboration.handleConnection(socket, request);
});

await app.listen({ port: PORT, host: '0.0.0.0' });
