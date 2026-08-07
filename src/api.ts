export interface RoomStatus {
  documentId: string;
  sourceRoomId: string;
  targetRoomId: string | null;
  status: 'editing-v1' | 'migrating' | 'seeding-v2' | 'migrated';
  migrationError: string | null;
  v1Archived: boolean;
}

export interface MigrationResponse extends RoomStatus {
  role: 'seeder' | 'joiner';
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? ('migrationError' in body ? String(body.migrationError) : `Request failed (${response.status})`));
  return body;
}

export const migrateRoom = (documentId: string) =>
  request<MigrationResponse>(`/api/rooms/${documentId}/migrate`, { method: 'POST' });
export const completeMigration = (documentId: string) =>
  request<RoomStatus>(`/api/rooms/${documentId}/complete`, { method: 'POST' });
