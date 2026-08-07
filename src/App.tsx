import { useCallback, useEffect, useState } from 'react';
import { completeMigration, migrateRoom, type RoomStatus } from './api';
import { V1Room } from './V1Room';
import { V2Room } from './V2Room';
import { StatusPanel } from './StatusPanel';
import { statusMessages } from './status-messages';

type Route = { version: 'v1' | 'v2'; documentId: string | null };

function readRoute(): Route {
  const match = window.location.pathname.match(/^\/(v1|v2)\/([^/]+)$/);
  return match ? { version: match[1] as Route['version'], documentId: match[2] } : { version: 'v1', documentId: null };
}

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

  const navigate = useCallback((version: Route['version'], documentId: string) => {
    statusMessages.clear();
    history.pushState({}, '', `/${version}/${documentId}`);
    setRoute({ version, documentId });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      statusMessages.clear();
      setRoute(readRoute());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (route.version === 'v2') void import('superdoc/style.css');
  }, [route.version]);

  const migrate = async () => {
    setMigrating(true);
    setError(null);
    statusMessages.message('V1 room migration started');
    try {
      const nextRoom = await migrateRoom(room.documentId);
      statusMessages.message('V1 room frozen');
      statusMessages.message('V1 room DOCX exported');
      statusMessages.message(nextRoom.role === 'seeder' ? 'V2 room seeder selected' : 'V2 room joiner selected');
      setRoom(nextRoom);
    } catch (reason) {
      statusMessages.message('V1 room migration failed');
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setMigrating(false);
    }
  };

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

      <div className={`notice ${room.status}`}>
        {room.status === 'editing-v1' && 'This is a live v1 room. Edit the document, then migrate it.'}
        {room.status === 'migrating' && 'Writers are frozen while the server snapshots, converts, seeds, and validates v2.'}
        {room.status === 'seeding-v2' && 'Creating the versioned v2 room from the exported DOCX.'}
        {room.status === 'migrated' && isV1 && 'Archived v1 room — the original state persists and is now read-only.'}
        {room.status === 'migrated' && !isV1 && 'Live v2 room — created from the frozen v1 collaboration state.'}
      </div>
      {error && <div className="error">{error}</div>}
      <main className="editor-shell">
        {isV1 ? (
          <V1Room key={room.sourceRoomId} roomId={room.sourceRoomId} readOnly={room.status !== 'editing-v1'} blank={blankV1} />
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
