import { activateRouting, verifyArchive } from './migration/routing.js';
import { exportMigrationDocx, freezeMigrationRoom } from './migration/handlers.js';
import type { RoomContext } from './migration/helpers.js';

type Handler = (context: RoomContext) => Promise<void>;

export class MigrationStepError extends Error {
  constructor(readonly step: string, readonly cause: unknown) {
    super(`Migration step "${step}" failed: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}

export class MigrationFacade {
  private freezeHandler: Handler = freezeMigrationRoom;
  private exportHandler: Handler = exportMigrationDocx;
  private seeders = new Map<string, Promise<boolean>>();
  private finishSeed = new Map<string, (ok: boolean) => void>();

  onFreeze(handler: Handler) { this.freezeHandler = handler; return this; }
  onExportDocx(handler: Handler) { this.exportHandler = handler; return this; }

  async executePrepare(context: RoomContext): Promise<'seeder' | 'joiner'> {
    const roomId = context.room.documentId;
    if (context.room.status === 'migrated') return 'joiner';

    const activeSeeder = this.seeders.get(roomId);
    if (activeSeeder) {
      if (!await activeSeeder) throw new Error('room seeding failed');
      return 'joiner';
    }

    this.seeders.set(roomId, new Promise((resolve) => this.finishSeed.set(roomId, resolve)));
    context.room.status = 'migrating';
    try {
      await this.run('freeze', this.freezeHandler, context);
      await this.run('export-docx', this.exportHandler, context);
      context.room.migrationDocx = context.docxBackup ?? null;
      context.room.pendingTargetRoomId = context.targetRoomId;
      context.room.status = 'seeding-v2';
      return 'seeder';
    } catch (error) {
      this.releaseSeeder(roomId, false);
      context.room.status = 'editing-v1';
      throw error;
    }
  }

  async executeComplete(context: RoomContext) {
    try {
      await this.run('activate', activateRouting, context);
      await this.run('archive', verifyArchive, context);
      this.releaseSeeder(context.room.documentId, true);
    } catch (error) {
      this.releaseSeeder(context.room.documentId, false);
      context.room.status = 'editing-v1';
      throw error;
    }
  }

  private releaseSeeder(roomId: string, ok: boolean) {
    this.finishSeed.get(roomId)?.(ok);
    this.finishSeed.delete(roomId);
    this.seeders.delete(roomId);
  }

  private async run(step: string, handler: Handler, context: RoomContext) {
    try {
      await handler(context);
    } catch (error) {
      throw new MigrationStepError(step, error);
    }
  }
}
