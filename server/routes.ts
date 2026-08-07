import type { FastifyInstance } from 'fastify';
import { Server } from '@hocuspocus/server';
import { createRoomContext, type RoomContext, type RoomMigrationService } from './room-migration-service.js';
import { createDemoRoom, getDemoRoom, publicRoom } from './room-store.js';

interface RouteDependencies {
  collaboration: ReturnType<typeof Server.configure>;
  collaborationUrl: string;
  migration: RoomMigrationService;
  knownDocumentIds: Set<string>;
  pendingMigrations: Map<string, RoomContext>;
}

// Registers the minimal HTTP endpoints used to prepare and complete migrations.
export function registerRoomRoutes(app: FastifyInstance, dependencies: RouteDependencies) {
  const { collaboration, collaborationUrl, migration, knownDocumentIds, pendingMigrations } = dependencies;

  app.get<{ Params: { documentId: string } }>('/api/rooms/:documentId/migrate', async (request, reply) => {
    const docx = getDemoRoom(request.params.documentId)?.migrationDocx;
    if (!docx) return reply.code(404).send({ message: 'Migration DOCX not found' });
    return reply.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(Buffer.from(docx));
  });

  app.post<{ Params: { documentId: string } }>('/api/rooms/:documentId/migrate', async (request, reply) => {
    const room = getDemoRoom(request.params.documentId) ?? createDemoRoom(request.params.documentId);
    knownDocumentIds.add(room.documentId);
    const roomContext = createRoomContext(
      room,
      collaborationUrl,
      (roomId, payload) => collaboration.documents.get(roomId)?.broadcastStateless(payload),
      () => collaboration.closeConnections(room.sourceRoomId),
    );

    try {
      await migration.prepareMigration(roomContext);
      pendingMigrations.set(room.documentId, roomContext);
      return reply.send(publicRoom(room));
    } catch (error) {
      room.migrationError = error instanceof Error ? error.message : String(error);
      return reply.code(500).send(publicRoom(room));
    }
  });

  app.post<{ Params: { documentId: string } }>('/api/rooms/:documentId/complete', async (request, reply) => {
    const roomContext = pendingMigrations.get(request.params.documentId);
    if (!roomContext) return reply.code(404).send({ message: 'Migration not found' });

    try {
      await migration.completeMigration(roomContext);
      pendingMigrations.delete(request.params.documentId);
      return reply.send(publicRoom(roomContext.room));
    } catch (error) {
      roomContext.room.migrationError = error instanceof Error ? error.message : String(error);
      return reply.code(500).send(publicRoom(roomContext.room));
    }
  });
}
