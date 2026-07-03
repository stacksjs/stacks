# Upgrade Guide

This guide covers the June 2026 security and correctness batch (issues #1947 through #1956). These changes harden authentication, database integrity, and logging. Several are breaking for apps that relied on the previous, looser behavior.

Each section below lists who is affected, how to detect whether the change impacts you, and how to remediate. If you only run one thing after upgrading, run `./buddy migrate` followed by `./buddy doctor` and skim the [Verifying the upgrade](#verifying-the-upgrade) checklist.

## Auto-CRUD writes now require authentication (#1949)

This is a breaking change for any app exposing anonymous writes.

### What changed

Models using the `useApi` trait now get the `auth` middleware on their `store`, `update`, and `destroy` routes by default. The read routes (`index` and `show`) stay public unless you declare otherwise. A model that explicitly declares a middleware list — including an empty one — has that list honored; an empty list logs a startup warning so the opt-out is never silent:

```
[orm] <Model>: registering UNAUTHENTICATED mutating routes at <path> (explicit `middleware: []` opt-out)
```

### Who is affected

Any app with bare `useApi: true` or `useApi: { uri }` models that accepted anonymous writes.

### Detect

```bash
grep -rn "useApi" app/Models/
curl -i -X POST http://localhost:3000/api/<model> -d '{}'
```

The `curl` now returns `401` where it previously created a record.

### Remediate

Pick one:

- Send a bearer token with mutating requests (the secure default).
- Opt out per model with `useApi: { middleware: [] }` (logs the warning above).
- Declare custom middleware, e.g. `useApi: { middleware: ['auth', 'throttle'] }`.

## Unique indexes are now enforced on SQLite (#1952)

### What changed

Nine unique-index migrations that the old SQLite preprocessing skipped now run. Each creates a single `CREATE UNIQUE INDEX IF NOT EXISTS` with a deliberately doubled `<table>_<table>_<col>` name (for example `users_users_email_unique` — do not "fix" this name, the detection queries depend on it):

| Migration | Table | Column |
| --- | --- | --- |
| 0000000086 | payments | transaction_id |
| 0000000087 | manufacturers | manufacturer |
| 0000000088 | customers | email |
| 0000000090 | authors | email |
| 0000000091 | subscribers | email |
| 0000000092 | gift_cards | code |
| 0000000093 | coupons | code |
| 0000000094 | subscriptions | provider_id |
| 0000000096 | users | email |

Databases that the old skip logic poisoned (it recorded these files as executed without ever creating the index) self-heal: on the next `./buddy migrate`, any recorded unique-index file whose index is missing from `sqlite_master` is un-recorded and replayed.

### Who is affected

Two groups:

- SQLite apps holding pre-existing duplicate values. `migrate` hard-fails with `SQLITE_CONSTRAINT` until the duplicates are removed.
- Apps scaffolded during the stub era, whose own `database/migrations/` copies contain `SELECT 1;` instead of the real SQL. The self-heal only replays files whose statements all match the `CREATE UNIQUE INDEX` pattern, so `SELECT 1;` stubs never replay and are already recorded as executed. Re-running `migrate` is not enough — the file content must be restored.

### Detect

Find duplicates per table before migrating (users/email shown; repeat for the other eight):

```bash
sqlite3 database/stacks.sqlite \
  "SELECT email, COUNT(_) c, GROUP_CONCAT(id) ids FROM users GROUP BY email HAVING c > 1;"
```

Find stub-era migration files that need restoring:

```bash
grep -l "SELECT 1" database/migrations/_unique-index_.sql
```

Confirm which unique indexes are actually live:

```bash
sqlite3 database/stacks.sqlite \
  "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%_unique';"
```

### Remediate

Back up `database/stacks.sqlite` before deduping — the next step is destructive and, with foreign keys now ON (see [#1951](#sqlite-now-enforces-foreign-keys-1951)), can cascade or fail against child rows.

Worked example for `users.email`:

1. Inspect the collisions with the `GROUP_CONCAT` query above to see every colliding `id`.
2. Repoint child rows at the survivor FIRST. For each table that references the duplicate user, update its foreign key to the `id` you intend to keep. Do this before deleting anything, or the delete will fail or orphan rows under the new FK regime.
3. Delete the losers, keeping the lowest id per group:

   ```bash
   sqlite3 database/stacks.sqlite \
     "DELETE FROM users WHERE id NOT IN (SELECT MIN(id) FROM users GROUP BY email);"
   ```

4. Restore any stub-era files the `grep` above flagged by copying the real `CREATE UNIQUE INDEX` statement from the framework repo into your app's matching `database/migrations/_.sql` file.
5. Re-run `./buddy migrate`.

### Behavior note

Duplicate writes now fail. The `register()` path maps unique violations to `409`, but other write paths currently surface `500` on a duplicate — that is a tracked follow-up, not a regression you introduced.

## SQLite now enforces foreign keys (#1951)

### What changed

Every SQLite connection bootstraps three pragmas at connect time:

```
PRAGMA journal_mode = WAL
PRAGMA foreign_keys = ON
PRAGMA busy_timeout = 5000
```

### Who is affected

Databases written while foreign keys were off may hold orphan rows. Deletes and inserts that previously succeeded can now fail with `FOREIGN KEY constraint failed`.

### Detect

```bash
sqlite3 database/stacks.sqlite "PRAGMA foreign_key_check;"
```

Empty output means the database is clean. You can also run `./buddy doctor` and read its `Database FKs` probe, which reports declared-but-missing foreign keys.

### Remediate

For each row `foreign_key_check` reports, either delete it or reattach it to a valid parent before resuming writes.

## A password reset signs out every device (#1947)

### What changed

Completing a password reset invalidates all existing access and refresh tokens and destroys all session rows for that user.

### Who is affected

Clients and support flows that assumed other sessions would survive a reset.

### Detect

Reset a test account, then confirm a token issued before the reset now returns `401`.

### Remediate

No server change is required. Update client UX to expect re-login everywhere after a reset. Note this is invalidation of all existing tokens and sessions, not race-free revocation: a refresh exchange interleaved with the post-reset sweep can still mint a pair (a documented follow-up), so do not rely on it as an atomic guarantee.

## /install and /test-error are local-only (#1955)

### What changed

The `/install` and `/test-error` routes register only when `APP_ENV` (falling back to `NODE_ENV`) is one of empty, `local`, `development`, `dev`, `test`, or `testing`.

### Who is affected

Staging or production probes and scripts that hit either path.

### Detect

```bash
curl -i https://yourapp.com/install
```

This returns `404` in production.

### Remediate

If you intentionally want either route in production, re-register the path against your own action in `routes/api.ts`. User routes load first, so your copy wins:

```ts
route.get('/install', 'Actions/InstallAction')
```

## Log contexts now serialize Errors (#1956)

### What changed

An `Error` anywhere in a log context now serializes as `{ name, message, stack, cause? }` instead of `{}`. The cause chain is followed to depth 8, and plain objects and arrays are walked to depth 4 so embedded errors survive.

### Who is affected

Log parsers and shippers keyed on the old empty-object shape.

### Detect

```ts
log.error('x', { error: new Error('y') })
```

Inspect the resulting line, or grep recent logs for `"stack":`.

### Remediate

Update parser schemas to read the new fields. Scrub stack paths if your logs leave the host.

## Auto-CRUD index responses are now flat (#1960)

### What changed

The generated auto-CRUD list endpoints (`GET /api/{model}`) now return pagination fields at the **top level**, matching the shape `Model.paginate()` already returned. The previous `meta` object is kept for this release but deprecated, and will be removed in a future release.

New top-level fields: `current_page`, `per_page`, `from`, `to`, `has_more_pages`, `prev_page_url`, `next_page_url`, plus (only with `?with_count=true`) `total`, `last_page`, `first_page_url`, `last_page_url`.

Field rename: `meta.page` is now `current_page` at the top level. The rest keep their names; they are simply lifted out of `meta`.

### Scope note

Applies only to generated auto-CRUD endpoints. Custom actions that return `Model.paginate()` / `simplePaginate()` / `cursorPaginate()` were always flat and are unchanged.

### Who is affected

Clients reading `response.meta.page` or other `response.meta._` fields from a generated list endpoint.

### Detect

```sh
curl -s http://localhost:3000/api/<model> | jq 'keys'
```

This now shows `current_page` and friends at the top level alongside `meta`.

### Remediate

Read the top-level fields. Replace `res.meta.page` with `res.current_page`, and `res.meta._` with `res.*`. The `total` / `last_page` fields remain opt-in behind `?with_count=true` (omitted otherwise, like a simple paginator). Stop depending on `meta`; it will be removed.

## Verifying the upgrade

Run through this checklist after upgrading:

- `./buddy migrate` — now fails loud on duplicate rows; resolve them as above.
- `./buddy doctor` — runs the `Database` and `Database FKs` probes today. A unique-index/duplicate-row check is a planned follow-up; until it ships, use the SQL in the [#1952 section](#unique-indexes-are-now-enforced-on-sqlite-1952) for duplicate detection.
- `sqlite3 database/stacks.sqlite "PRAGMA foreign_key_check;"` — expect empty output on a clean, freshly migrated database.
- Anonymous-write spot check: `curl -i -X POST http://localhost:3000/api/<model> -d '{}'` should return `401`.
- Generated list endpoint: `curl -s http://localhost:3000/api/<model> | jq 'keys'` now exposes `current_page` at the top level.
