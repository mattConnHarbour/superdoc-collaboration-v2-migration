import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SuperDocClient } from '@superdoc-dev/sdk';
import type { DemoRoom } from './room-store.js';

export interface RoomContext {
  room: DemoRoom;
  collaborationUrl: string;
  broadcastViewOnly: (roomId: string) => void;
  closeWriters: () => void;
  targetRoomId: string;
  docxBackup?: Uint8Array;
}

// Builds the shared state and callbacks required by the migration service.
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

const TOKEN_ENV = 'COLLAB_MIGRATION_TOKEN';
type Step = (context: RoomContext) => Promise<void>;

export class MigrationStepError extends Error {
  // Identifies the lifecycle operation that caused a migration to fail.
  constructor(readonly step: string, readonly cause: unknown) {
    super(`Migration step "${step}" failed: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}

export class RoomMigrationService {
  // Freezes and exports the source room so the client can create V2.
  async prepareMigration(context: RoomContext) {
    if (context.room.status === 'migrated') return;
    context.room.status = 'migrating';
    try {
      await this.run('freeze', this.freezeRoom, context);
      await this.run('export-docx', this.exportDocx, context);
      context.room.migrationDocx = context.docxBackup ?? null;
      context.room.pendingTargetRoomId = context.targetRoomId;
      context.room.status = 'seeding-v2';
    } catch (error) {
      context.room.status = 'editing-v1';
      throw error;
    }
  }

  // Activates the seeded V2 room and archives the original V1 room.
  async completeMigration(context: RoomContext) {
    try {
      await this.run('activate', this.activateRoom, context);
      await this.run('archive', this.archiveRoom, context);
    } catch (error) {
      context.room.status = 'editing-v1';
      throw error;
    }
  }

  // Makes the source room read-only and disconnects its active writers.
  private freezeRoom = async (context: RoomContext) => {
    context.broadcastViewOnly(context.room.sourceRoomId);
    context.closeWriters();
  };

  // Opens the source collaboration state and saves it as an in-memory DOCX.
  private exportDocx = async (context: RoomContext) => {
    const directory = await mkdtemp(join(tmpdir(), 'collab-room-export-'));
    const output = join(directory, 'migration.docx');
    const client = new SuperDocClient();
    process.env[TOKEN_ENV] = 'demo';

    try {
      await client.connect();
      const document = await client.open({
        doc: resolve('public/seed.docx'),
        collaboration: {
          providerType: 'hocuspocus',
          url: context.collaborationUrl,
          documentId: context.room.sourceRoomId,
          tokenEnv: TOKEN_ENV,
          onMissing: 'error',
        },
      });
      await document.save({ out: output, force: true });
      await document.close();
      context.docxBackup = new Uint8Array(await readFile(output));
    } finally {
      await client.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  };

  // Updates room routing so future navigation points to the V2 room.
  private activateRoom = async (context: RoomContext) => {
    if (context.room.targetRoomId === context.targetRoomId) return;
    if (context.room.targetRoomId !== null) throw new Error('another target is already active');
    context.room.targetRoomId = context.targetRoomId;
    context.room.pendingTargetRoomId = null;
    context.room.routingVersion += 1;
  };

  // Marks the migration complete after confirming that V2 routing is active.
  private archiveRoom = async (context: RoomContext) => {
    if (context.room.targetRoomId !== context.targetRoomId) throw new Error('routing does not point to the target');
    context.room.status = 'migrated';
  };

  // Runs one lifecycle operation and annotates any error with its step name.
  private async run(step: string, operation: Step, context: RoomContext) {
    try {
      await operation(context);
    } catch (error) {
      throw new MigrationStepError(step, error);
    }
  }
}
