export interface RoomStatus {
  documentId: string;
  sourceRoomId: string;
  targetRoomId: string | null;
  status: 'editing-v1' | 'migrating' | 'seeding-v2' | 'migrated';
  migrationError: string | null;
  v1Archived: boolean;
}

// Sends an API request and converts unsuccessful responses into errors.
async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? ('migrationError' in body ? String(body.migrationError) : `Request failed (${response.status})`));
  return body;
}

// Asks the server to freeze and export a V1 room for migration.
export const migrateRoom = (documentId: string) =>
  request<RoomStatus>(`${API_URL}/api/rooms/${documentId}/migrate`, { method: 'POST' });
// Tells the server that V2 seeding finished and routing can be activated.
export const completeMigration = (documentId: string) =>
  request<RoomStatus>(`${API_URL}/api/rooms/${documentId}/complete`, { method: 'POST' });
import { API_URL } from './config';
