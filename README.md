# Manual collaboration migration demo

This standalone demo migrates a live v1 collaboration room using only public
SuperDoc packages:

1. Capture the v1 Yjs state in memory.
2. Export that state to DOCX on the server.
3. Open the DOCX with SuperDoc v2 using `roomMode: 'create'`.
4. Let v2 generate and commit its current collaboration schema in the
   versioned provider room `sd2/v2.1/<roomId>`.
5. Reopen the completed room with `roomMode: 'join'`.

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
