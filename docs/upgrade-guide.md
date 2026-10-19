---
title: Upgrade Guide
description: "This guide covers the June 2026 security and correctness batch (issues #1947 through #1956). These changes harden authentication, database integrity, and l..."
---
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

## The API server no longer serves pages (#2314)

### What changed

The API process used to mount a GET route for every `.stx` under
`resources/views`, because bun-router discovers that directory on its own. It
now serves `/api` and nothing else. Requests to any other path answer `404`
JSON.

Nothing was ever meant to read those pages. The API process has no static-asset
handling and no CSS pipeline, so the HTML it emitted carried no stylesheet and
every image 404'd: it only rendered correctly when fetched through a different
server. In dev the views server renders pages and proxies `/api/**` to the API
process, and in production `buddy serve` does the same, so the API process is
the proxy target in both.

Declared routes are unaffected. bun-router already skipped a discovered view
when a GET route existed at that path, so nothing that answers a route today
changes.

### Who is affected

Monitoring, scripts or bookmarks pointed at a non-`/api` path **on the API
port** (3008 by default) rather than at the site. Traffic through the site
itself is unchanged, because that never reached this process.

### Detect

```bash
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://127.0.0.1:3008/
```

`404 application/json` is the new behaviour. If you were relying on the page,
this used to be `200 text/html`.

### Remediate

Point the request at the site rather than the API port. If you genuinely want
pages from this process, ask for file routing before the server starts and it
is left alone:

```ts
// routes/api.ts, or anywhere that runs during route loading
route.bunRouter.views({ viewsPath: 'resources/views' })
```

Health probes should use `/api/health`, which reports `503` when the database
or cache is down.

## Deploys now dump the database before migrating (#2313)

### What changed

`buddy deploy` runs `migrate` against production on every release, and there was
nothing to go back to if a migration did something nobody meant. The site that
runs `migrate` now takes a dump immediately before it:

```bash
bun … cli.ts db:backup --before-migrations --out /var/www/<slug>-shared/backups
bun … cli.ts migrate
```

The dump lands beside the database, outside every release tree, so the release
pruner cannot delete it along with the release that took it. Seven are kept.

Three commands come with it: `db:backup`, `db:backups`, and `db:restore`.

### Who is affected

Every app that deploys with `preStart` running `migrate`, which the scaffold
does. Nothing to configure; it is on.

**If the dump fails, the deploy stops before migrating.** That is the point: the
alternative is changing the schema of a database you have no copy of. A first
deploy, with no database yet, succeeds quietly.

### Detect

```bash
./buddy db:backup            # does a dump of your database work at all?
./buddy doctor               # the "Database backups" probe
```

For Postgres and MySQL this shells out to `pg_dump` / `mysqldump`, so those must
be on the box and version-compatible with the server. A mismatch now fails the
deploy rather than being discovered during an incident.

### Remediate

Nothing, if `./buddy db:backup` succeeds. If your engine is one Stacks will not
dump (vitess, DynamoDB) the deploy is unchanged and `doctor` says so.

To place the dump yourself, run `db:backup` anywhere in that site's `preStart`
and the framework leaves your ordering alone.

**These dumps are not offsite.** They survive a bad migration, not the loss of
the instance. Copy them off the box on a schedule, and restore one into a
scratch database at least once. See
[Database Backups](/guide/buddy/db).

## `ignorePreferences` no longer texts numbers that replied STOP

### What changed

`notify(..., { ignorePreferences: true })` used to skip both the user's
notification preferences and the SMS STOP check. STOP is a legal opt-out, not a
preference, so the two are now separate: `ignorePreferences` skips preferences
only, and a new `ignoreOptOut: true` is the one way past STOP.

### Who is affected

Apps that send SMS through `notify()` with `ignorePreferences: true` to numbers
that may have replied STOP. Those sends now fail with
`[notify] sms recipient has opted out (STOP)` and the delivery log records it.

### Detect

```bash
grep -rn "ignorePreferences" app/
```

Look at each hit that includes the `'sms'` channel.

### Remediate

For a message the law requires you to send whatever the person's consent (a
mandated security or safety notice), add `ignoreOptOut: true`. For everything
else, including marketing and ordinary transactional texts, leave it failing:
carriers filter senders that keep texting after STOP. `ignoreOptOut` does not
skip preferences; keep `ignorePreferences` as well if you need both.

## Stripe webhook handlers run once per event id

### What changed

`processWebhook` and `handleWebhookEvent` now skip an event whose id already
ran its handlers, and answer `duplicate: true`. The id is recorded in
`payment_webhook_events` (provider `stripe:handlers`) only after every handler
succeeded, so a failed handler still gets Stripe's retry. The driver path
(`paymentDriver().verifyWebhook`) now honours `payment.stripe.webhookTolerance`
(or `payment.webhook.tolerance`); it used to verify with Stripe's default.

Connected-account creation keys its idempotency on the user, an optional
`reference` and the creation parameters instead of the user alone, so one user
can create a second account (a gym and a coach storefront) the same day.

### Who is affected

Apps that register Stripe handlers with `onWebhookEvent` / `Payment.on*` and
relied on a replayed event running them again, and apps whose users own more
than one connected account.

### Remediate

Run `./buddy migrate` so `payment_webhook_events` exists; until it does, ids
are remembered in memory only, with a warning. Pass `{ dedupe: false }` to
`processWebhook` to keep the old behaviour. Pass
`{ reference: 'gym:12' }` as the third argument of `createConnectedAccount`
wherever one user can own several accounts.

## Social sign-in checks OAuth `state` and hands over a one-use code

### What changed

The default social routes (`/auth/{provider}`, `/auth/{provider}/callback`)
now protect against login CSRF and keep tokens out of URLs:

- `GET /auth/{provider}` issues the OAuth `state` with `issueOAuthFlow()`
  (`@stacksjs/socials`): single use, ten minutes, stored as a SHA-256 digest
  in the auth-owned `oauth_flows` table, and bound to the browser with an
  HttpOnly `stacks_oauth_*` cookie. Apple's flow carries a nonce that must
  come back in the id_token; X's carries its PKCE verifier.
- The callback redeems that state with `consumeOAuthFlow()` before it
  exchanges the code. A callback whose state is unknown, spent, expired or
  from another browser lands on `/login?social_error=...` without contacting
  the provider.
- The callback no longer mints a session or puts `stx_auth` (bearer and
  refresh tokens) in the URL fragment. It redirects with
  `#stx_handoff=<code>`: a 60-second, single-use code from
  `createSessionHandoff()` (`@stacksjs/auth`), bound to a second HttpOnly
  cookie. `useAuth().completeSocialLogin()` POSTs the code to the new
  `POST /auth/handoff` route (`SessionHandoffAction`), which answers with the
  session and the auth cookie.
- `?redirect_to=/path` on `/auth/{provider}` picks the landing page (a
  same-origin path only).
- The POST callback (Apple's `form_post`) skips CSRF: the browser-bound
  state is the CSRF defence there.

### Who is affected

- Apps on the default routes: run `./buddy migrate` so `oauth_flows`
  exists, and make sure the landing page calls
  `useAuth().completeSocialLogin()` (it already had to). A sign-in that
  started before the deploy fails once with "expired" and works on retry.
- Apps that read the `stx_auth` fragment themselves after the default
  callback: read `stx_handoff` and redeem it at `/auth/handoff` instead, or
  call `completeSocialLogin()`.
- Apps with their own callback actions: nothing changes, but use the same
  primitives (`issueOAuthFlow`, `consumeOAuthFlow`, `createSessionHandoff`,
  `redeemSessionHandoff`, `socialHandoffCodeRedirect`) rather than
  exchanging any code you are given.

### Detect

```bash
grep -rn "stx_auth\|socialHandoffRedirect\|readSessionHandoff" app/ resources/
```

## Social sign-in no longer links onto an unverified local account

### What changed

`resolveSocialSignIn()` already refused to link a provider identity whose
email the provider did not verify. It now also refuses when the matching
local account never verified its own address (`users.email_verified_at` is
null), with the new reason `'unverified-local-email'`. Otherwise an attacker
could register the victim's address locally with a password they know and
inherit the victim's first "Sign in with Google".

A user created from a provider-verified address now starts with
`email_verified_at` set. Store methods receive the `tx` passed as
`resolveSocialSignIn(provider, identity, store, { tx })`, and a store may
implement `isUserEmailVerified(userId, tx)`; one that does not gets the
default, which reads `users.email_verified_at`.

### Who is affected

Apps whose users registered with a password, never verified, and now sign in
with a provider using the same address. They see the refusal message and
must sign in with their password and verify first (or connect the provider
from their settings). Apps rendering `SocialSignInRefusedError.reason`
should handle `'unverified-local-email'`.

Custom stores: `createUser` receives `emailVerified`; stamp
`email_verified_at` from it if your store writes users itself.

## One credential sweep for password changes, and `revokeOtherTokens` fails closed

### What changed

- `revokeAccountCredentials(userId, { exceptTokenId?, exceptSessionId?, tx? })`
  is the sweep a password reset always ran, exported: it stamps
  `password_changed_at` and revokes two-factor challenges, magic links, OAuth
  grants and codes, tokens and sessions in one transaction.
  `changePassword(userId, current, next, { keepTokenId?, keepSessionId?, notify? })`
  verifies the current password and runs it.
- `Auth.revokeOtherTokens()` did nothing when no current token resolved (a
  cookie-session request). It now revokes every token, like the
  `revokeOtherTokens()` function export, and both return
  `{ keptTokenId }`. Pass `{ exceptTokenId }` to name the token to keep.
- `passwordResets(email).sendEmail()` takes `{ purpose: 'reset' | 'setup',
  expiresAt, deliver }`.

### Who is affected

Apps that call `Auth.revokeOtherTokens()` from a session-authenticated
request: the caller's own tokens are now revoked too. Pass `exceptTokenId`
if you know which one to keep. Apps with their own change-password actions
should call `changePassword()` (or `revokeAccountCredentials()` after their
own update) so the change signs out other devices.

## Rate limits are shared across processes when Redis is configured

### What changed

Route `.rateLimit()`, the `rateLimit()` helper and the login lockout count in
the configured Redis cache (`config/cache.ts` driver `redis`) and fall back
to process memory only while Redis is unreachable. They previously counted
per process. `config.security.rateLimit.scale` (or
`STACKS_RATE_LIMIT_SCALE`) multiplies every application limit and the
lockout threshold, for test suites. `config.security.trustedProxies` sets the
proxies whose forwarding headers `clientAddress()` from `@stacksjs/router`
believes; unset keeps the default of loopback and private networks.

### Who is affected

Apps running several workers or instances on Redis: limits now hold across
them, so a limit tuned to "N per worker" is effectively N per app. Test
suites that hit limits can set `STACKS_RATE_LIMIT_SCALE=100` instead of
disabling them.

## Verifying the upgrade

Run through this checklist after upgrading:

- `./buddy migrate` — now fails loud on duplicate rows; resolve them as above.
- `./buddy doctor` — runs the `Database`, `Database FKs`, and `Unique indexes` probes, so it now surfaces both orphaned rows and model-declared unique attributes missing their index. The SQL in the [#1952 section](#unique-indexes-are-now-enforced-on-sqlite-1952) remains useful for cleaning up whatever it finds.
- `sqlite3 database/stacks.sqlite "PRAGMA foreign_key_check;"` — expect empty output on a clean, freshly migrated database.
- Anonymous-write spot check: `curl -i -X POST http://localhost:3000/api/<model> -d '{}'` should return `401`.
- Generated list endpoint: `curl -s http://localhost:3000/api/<model> | jq 'keys'` now exposes `current_page` at the top level.
