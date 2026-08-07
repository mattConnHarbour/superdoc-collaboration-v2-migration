# Manual collaboration migration demo

This standalone demo migrates a live v1 collaboration room using only public
SuperDoc packages.

## Migration flow

- **Connect V1:** The client joins `<documentId>-v1` while the server keeps its latest Yjs state in memory.
- **Start migration:** The initiating client sends `POST /api/rooms/<documentId>/migrate` with no request body.
- **Freeze V1:** The server broadcasts `{"type":"room-view-only"}`, locks connected editors, and closes writer connections.
- **Export DOCX:** `RoomMigrationService` opens the frozen V1 room and stores its DOCX bytes in memory.
- **Prepare V2:** The server returns the target room ID with the `seeding-v2` status.
- **Open V2:** The initiating client fetches the DOCX with `GET /api/rooms/<documentId>/migrate`.
- **Seed V2:** SuperDoc creates `sd2/v2.1/<documentId>-v2` from the DOCX using `roomMode: 'create'`.
- **Complete migration:** The client sends `POST /api/rooms/<documentId>/complete` after collaboration is ready.
- **Finalize:** The server activates V2, archives V1, and notifies connected V1 users that V2 is ready.
- **Reopen V2:** Later clients connect to the completed room using `roomMode: 'join'`.

`RoomMigrationService` owns the lifecycle and always executes its operations in
the required order, identifying a failed step in the thrown error.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3100>. API is on 3101 and Hocuspocus is on 1235.

For deployment, set `VITE_COLLAB_URL` to the public `wss://` collaboration URL
used by browsers. Set `COLLAB_URL` to the WebSocket URL reachable by the server
for server-side DOCX export. See `.env.example` for local defaults.

All room state and DOCX data are intentionally stored in memory and disappear
when the server stops.
