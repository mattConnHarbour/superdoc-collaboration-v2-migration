import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SuperDocClient } from '@superdoc-dev/sdk';
import type { RoomContext } from './helpers.js';

const TOKEN_ENV = 'COLLAB_MIGRATION_TOKEN';

export async function freezeMigrationRoom(context: RoomContext) {
  context.broadcastViewOnly(context.room.sourceRoomId);
  context.closeWriters();
}

export async function exportMigrationDocx(context: RoomContext) {
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
}
