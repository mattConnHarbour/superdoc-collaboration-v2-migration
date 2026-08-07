import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import { createRoomContext, RoomMigrationService } from './room-migration-service.js';
import { registerRoomRoutes } from './routes.js';
import { getDemoRoom } from './room-store.js';

const API_PORT = Number(process.env.API_PORT ?? 3101);
const COLLAB_PORT = Number(process.env.COLLAB_PORT ?? 1235);
const COLLAB_URL = process.env.COLLAB_URL ?? `ws://127.0.0.1:${COLLAB_PORT}`;
const snapshots = new Map<string, Uint8Array>();
const knownDocumentIds = new Set<string>();
const pendingMigrations = new Map<string, ReturnType<typeof createRoomContext>>();
const V2_ROOT_MAPS = ['capabilities', 'checkpoints', 'content', 'journal-capability', 'meta', 'operations', 'package', 'shards'] as const;

const collaboration = Server.configure({
  port: COLLAB_PORT,
  yDocOptions: { gc: false, gcFilter: () => true },
  debounce: 100,
  maxDebounce: 500,
  // Prevents writes when a client connects to an archived V1 room.
  async onConnect({ documentName, connection }) {
    const room = [...roomsForLookup()].find((candidate) => candidate.sourceRoomId === documentName);
    if (room && room.status !== 'editing-v1') connection.readOnly = true;
  },
  // Restores the latest in-memory Yjs snapshot when a room is opened.
  async onLoadDocument({ documentName, document }) {
    const update = snapshots.get(documentName);
    if (update) {
      if (documentName.startsWith('sd2/v2.1/')) for (const rootMap of V2_ROOT_MAPS) document.getMap(rootMap);
      Y.applyUpdate(document, update);
    }
    return document;
  },
  // Captures each changed room as an in-memory Yjs update.
  async onChange({ documentName, document }) {
    snapshots.set(documentName, Y.encodeStateAsUpdate(document));
  },
});

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
registerRoomRoutes(app, { collaboration, collaborationUrl: COLLAB_URL, migration, knownDocumentIds, pendingMigrations });

await app.listen({ port: API_PORT, host: '0.0.0.0' });
collaboration.listen();
