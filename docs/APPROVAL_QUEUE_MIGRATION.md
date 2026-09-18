# Approval queue migration

Admin snapshot loading now queries `updateApprovals` with `status == "pending"`, following document-name cursors in pages of 200. It no longer reads each pending user's document. A separate filtered query retains up to 150 rejected records for the existing history tab; approved history is not downloaded.

New update and manual dictionary submissions commit queue records and user pending metadata in the same write batch. A failed queue write no longer falls back to user-only storage. Per-user detail reads remain available when opening or processing a request.

Before deploying this reader to an existing database:

1. Pause approval submissions and completions during migration.
2. With Firebase Admin application default credentials configured, run `node scripts/migrateApprovalQueue.mjs` for a dry run.
3. Run `node scripts/migrateApprovalQueue.mjs --apply`, then rerun the dry run to verify no records remain to create.
4. Deploy the queue reader and resume approval activity.

The migration reads collections in pages, copies user-only pending payloads into deterministic queue IDs, skips existing queue requests, and never overwrites queue documents or reopens a completed deterministic migration record. Keep submissions/completions paused to prevent changes between scanning and committing. No migration or deployment is performed automatically by the app.

The query uses Firestore's structured query and cursor API: [runQuery documentation](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/runQuery).
