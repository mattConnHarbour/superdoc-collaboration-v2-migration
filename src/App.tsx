import { useCallback, useEffect, useRef, useState } from 'react';
import { completeMigration, migrateRoom, type RoomStatus } from './api';
import { V1Room } from './V1Room';
import { V2Room } from './V2Room';
import { StatusPanel } from './StatusPanel';
import { statusMessages } from './status-messages';

type Route = { version: 'v1' | 'v2'; documentId: string | null };

// Parses the selected room version and document ID from the browser URL.
function readRoute(): Route {
  const match = window.location.pathname.match(/^\/(v1|v2)\/([^/]+)$/);
  return match ? { version: match[1] as Route['version'], documentId: match[2] } : { version: 'v1', documentId: null };
}

// Coordinates navigation, migration requests, and the active room UI.
export default function App() {
  const [route, setRoute] = useState<Route>(() => {
    const initial = readRoute();
    if (initial.documentId) return initial;
    const documentId = crypto.randomUUID().slice(0, 8);
    history.replaceState({}, '', `/v1/${documentId}`);
    return { version: 'v1', documentId };
  });
  const [room, setRoom] = useState<RoomStatus>(() => ({
    documentId: route.documentId!,
    sourceRoomId: `${route.documentId}-v1`,
    targetRoomId: route.version === 'v2' ? `${route.documentId}-v2` : null,
    status: route.version === 'v2' ? 'migrated' : 'editing-v1',
    migrationError: null,
    v1Archived: route.version === 'v2',
  }));
  const [error, setError] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [blankV1, setBlankV1] = useState(false);
  const migrationStartedHere = useRef(false);

  // Navigates to another room and starts its activity log from empty.
  const navigate = useCallback((version: Route['version'], documentId: string) => {
    statusMessages.clear();
    history.pushState({}, '', `/${version}/${documentId}`);
    setRoute({ version, documentId });
  }, []);

  // Keeps application routing synchronized with browser back and forward actions.
  useEffect(() => {
    const onPopState = () => {
      statusMessages.clear();
      setRoute(readRoute());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Loads V2 styling only when a V2 room is displayed.
  useEffect(() => {
    if (route.version === 'v2') void import('superdoc/style.css');
  }, [route.version]);

  // Starts migration preparation and updates the room with its V2 target.
  const migrate = async () => {
    migrationStartedHere.current = true;
    setMigrating(true);
    setError(null);
    statusMessages.message('V1 room migration started');
    try {
      const nextRoom = await migrateRoom(room.documentId);
      statusMessages.message('V1 room frozen');
      statusMessages.message('V1 room DOCX exported');
      setRoom(nextRoom);
    } catch (reason) {
      statusMessages.message('V1 room migration failed');
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      migrationStartedHere.current = false;
      setMigrating(false);
    }
  };

  // Creates and navigates to a new blank V1 collaboration room.
  const newBlankV1Room = () => {
    const documentId = crypto.randomUUID().slice(0, 8);
    setRoom({
      documentId,
      sourceRoomId: `${documentId}-v1`,
      targetRoomId: null,
      status: 'editing-v1',
      migrationError: null,
      v1Archived: false,
    });
    setBlankV1(true);
    setError(null);
    navigate('v1', documentId);
  };

  // Disables V1 controls when another connected user starts migration.
  const handleFrozen = useCallback(() => {
    if (!migrationStartedHere.current) statusMessages.message('V1 room migration started by other user');
    setRoom((current) => ({ ...current, status: 'migrating' }));
  }, []);

  // Applies the completed migration announced by the collaboration server.
  const handleMigrationReady = useCallback((targetRoomId: string) => {
    setRoom((current) => ({
      ...current,
      targetRoomId,
      status: 'migrated',
      v1Archived: true,
    }));
  }, []);

  const isV1 = route.version === 'v1';
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className={`version-badge ${isV1 ? 'v1' : 'v2'}`}>{isV1 ? 'V1' : 'V2'}</span>
          <h1>Collaboration migration demo</h1>
          <p>{isV1 ? room.sourceRoomId : room.targetRoomId}</p>
        </div>
        <div className="actions">
          <button onClick={newBlankV1Room}>New blank V1 room</button>
          {isV1 ? (
            <>
              <button className="primary" disabled={room.status !== 'editing-v1' || migrating} onClick={migrate}>
                {migrating ? 'Migrating…' : 'Migrate to V2'}
              </button>
              <button disabled={!room.targetRoomId} onClick={() => navigate('v2', room.documentId)}>
                Go to V2 room
              </button>
            </>
          ) : (
            <button onClick={() => navigate('v1', room.documentId)}>Go to v1 room</button>
          )}
          <span id="document-actions" className="document-actions" />
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      <main className="editor-shell">
        {isV1 ? (
          <V1Room
            key={room.sourceRoomId}
            roomId={room.sourceRoomId}
            readOnly={room.status !== 'editing-v1'}
            blank={blankV1}
            canNavigateToV2={Boolean(room.targetRoomId)}
            onFrozen={handleFrozen}
            onMigrationReady={handleMigrationReady}
          />
        ) : room.targetRoomId ? (
          <V2Room
            key={`${room.targetRoomId}-${room.status}`}
            documentId={room.documentId}
            roomId={room.targetRoomId}
            mode={room.status === 'seeding-v2' ? 'create' : 'join'}
            onReady={room.status === 'seeding-v2' ? () => {
              statusMessages.message('V2 room activating');
              void completeMigration(room.documentId).then((nextRoom) => {
                setRoom(nextRoom);
                statusMessages.message('V2 room migration complete');
              }).catch((reason) => {
                statusMessages.message('V2 room migration failed');
                setError(reason instanceof Error ? reason.message : String(reason));
              });
            } : undefined}
          />
        ) : null}
      </main>
      <StatusPanel />
    </div>
  );
}
