# Manual collaboration migration demo

This standalone demo migrates a live v1 collaboration room using only public
SuperDoc packages:

1. Capture the v1 Yjs state in memory.
2. Export that state to DOCX on the server.
3. Open the DOCX with SuperDoc v2 using `roomMode: 'create'`.
4. Let v2 generate and commit its current collaboration schema in the
   versioned provider room `sd2/v2.1/<roomId>`.
5. Release waiting clients to reopen it with `roomMode: 'join'`.

The lifecycle functions are kept separate and imported by `MigrationFacade`.
Named handler overrides may be chained in any order; the facade always executes
the required order and identifies a failed step in the thrown error.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3100>. API is on 3101 and Hocuspocus is on 1235.

All room state and DOCX data are intentionally stored in memory and disappear
when the server stops.
