---
name: stacks-hq
description: Use when metering usage against a plan allowance, answering the X-HQ-Usage header, mounting an HQ service's connect and usage endpoints, connecting an app with buddy hq:connect, or reading an HQ service from an app. Covers @stacksjs/hq (meter, service, client, testing), the HQ entries in config/services.ts and buddy hq:status.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# HQ services: metering, the service contract, readers

`@stacksjs/hq` holds what every Stacks HQ service (BugHQ, LogHQ, AnalyticsHQ,
StatusHQ, CommsHQ) must do the same way. The services stay separate: each keeps
its own accounts, keys, plans and billing. This package shares code, never
identity. It has no runtime dependencies; a database client or a store is
passed in.

Import from the subpath you need: `@stacksjs/hq/meter`, `@stacksjs/hq/service`,
`@stacksjs/hq/client`, `@stacksjs/hq/testing`.

## Meter

Two primitives, chosen by who is waiting on the answer.

**Counter, for ingest.** `createCounter({ store })` buffers deltas in memory and
folds them into `usage_counters` on a timer (ten seconds by default). `record`
and `admit` never await and never query, so metering adds no round-trip to an
ingest route. The fold is an additive upsert computed by the database, so
several app instances converge on one total. A crash loses at most one flush
interval.

- `sqlCounterStore(db, { dialect })` is the store over `usage_counters`, keyed by
  (owner, meter, period). The period is `YYYY-MM` in UTC (`periodOf`).
- `usageCountersMigrationSql({ dialect })` returns the table's DDL for a
  migration; `ensureUsageCountersTable(db)` provisions it explicitly. Nothing is
  written implicitly.
- `counter.admit(owner, meter, limit)` decides one event and counts it. Kept
  events count under `meter`, dropped ones under `droppedMeter(meter)`.
- `usageOf` answers `null` when nothing is known yet. Read that as "no reason to
  act", not as zero.

**Reservation, for sends.** `reserveUsage(store, meter, quantity)` and
`releaseUsage` are a compare-and-set against a `UsageQuotaStore`. They fail
closed with `UsageQuotaError` (`unavailable`, `invalid`, `exceeded`,
`contention`). `@stacksjs/newsletter` re-exports them unchanged.

**Policy.** `evaluate(used, limit, policy)` is pure and returns
`{ state, allowed, used, limit, ceiling }`. `used` includes the unit being
decided. Thresholds are computed in integers.

| State | Meaning |
|---|---|
| `ok` | under 80% of the allowance |
| `warn` | 80% or more, still inside it |
| `over` | allowance used up; the 20% grace is being spent, or a send is refused |
| `sampled` | an ingest meter past 120%, keeping one event in ten |

- `SOFT_INGEST` (`'soft-ingest'`): take everything to 120%, then keep every
  tenth event. The choice is deterministic. Never answer non-2xx for quota: an
  SDK would retry.
- `HARD_SEND` (`'hard-send'`): after the 20% grace `allowed` is false.
  `enforceQuota(meter, used, limit)` throws the typed `QuotaExceededError`.
- A `null` limit is unlimited. A limit of `0` refuses the first send.

## The usage header

Every 2xx ingest response carries `X-HQ-Usage` (`USAGE_HEADER`):

```text
X-HQ-Usage: errors;412;500;warn;upgrade=https%3A%2F%2Fbughq.example%2Fpricing
```

The fields are `meter;used;limit;state;upgrade=<url>`. The limit is `unlimited`
for an unlimited meter, and the URL is percent-encoded. Build it with
`formatUsageHeader` and read it with `parseUsageHeader`, which answers `null`
for anything malformed instead of throwing.

```ts
const admission = counter.admit(project.owner_id, 'errors', limits.errors)
if (admission.accept)
  await store(event)
return new Response(null, {
  status: 202,
  headers: { [USAGE_HEADER]: formatUsageHeader({ ...admission, upgradeUrl }) },
})
```

## Service contract

`createHqService(adapter)` returns handlers a service mounts in its own
`routes/hq.ts`. They take a Fetch-style request and return a `Response`.

| Route | Answer |
|---|---|
| `POST /api/cli/connect` | `201 { code, approveUrl }` |
| `GET /api/cli/connect/{code}` | `{ status: 'pending' }`, or once approved `{ status: 'approved', project, ingestKey, readKey, dashboardUrl }`; `404 { status: 'expired' }` after that |
| `GET /api/v1/usage` | `{ meter, used, limit, period, state, upgradeUrl }[]`, authorised by `Authorization: Bearer <read key>` |

The adapter (`HqServiceAdapter`) is what the service implements: `approveUrl`,
`upgradeUrl`, `codes`, `provision`, `authenticateReadKey`, `usage`. The approve
page calls `describeConnect(code)` to show the app name and
`approveConnect(code, user)` once a signed-in user confirms.

Codes are single-use and expire after ten minutes. A store holds only the
SHA-256 of a code, and the approved keys wait encrypted under a key derived from
the code, so the table never contains a pollable code or a readable key. Use
`sqlConnectCodeStore(db)` with `connectCodesMigrationSql()`, or
`createMemoryConnectCodeStore()` in tests. Rate-limit `POST /api/cli/connect` in
the service's router.

Run the shared contract against the real adapter:

```ts
import { hqServiceContract } from '@stacksjs/hq/testing'

hqServiceContract('bughq', async () => ({ adapter, user: await signedInUser() }))
```

`createMemoryHqAdapter()` is a complete in-memory service for an app's own tests.

## Client

`createHqClient({ services })` takes each service's own `url`, `readKey` and
`project`. Readers never throw into the caller: every failure is an
`HqUnavailable` value with a `reason` (`not_configured`, `unauthorized`,
`timeout`, `network`, `http`, `bad_response`).

```ts
const usage = await hq.getUsage('bughq')
if (usage.ok)
  render(usage.data)
```

- `getUsage(service)` reads `GET /api/v1/usage`.
- `logs.list(query)` reads LogHQ's `GET /api/projects/{project}/logs`.
- `issues.list(query)` reads BugHQ's `GET /api/projects/{project}/issues`.
- `AnalyticsReader`, `UptimeReader` and `CommsReader` are interfaces only; the
  package README lists the endpoint each service must expose first.

## Connecting an app

An app connects with `buddy hq:connect [service...]` (BugHQ and LogHQ when none
is named). For each service the command starts a connect, prints the approve
link and any confirmation code, opens the browser, waits for the approval, and
writes that service's keys to `.env`: `BUGHQ_KEY`, `BUGHQ_READ_KEY`,
`BUGHQ_PROJECT_ID`, `LOGHQ_KEY`, `LOGHQ_READ_KEY`, `LOGHQ_PROJECT_ID`. A key is
never printed. It then sends one test error and one test log and reads each
back with the read key. `--no-open` and `--no-verify` skip those steps, and a
service that answers 404 on the connect route is reported as not available yet
without failing the others.

`config/services.ts` lists each service's URL, keys and project, as
`services.bughq`, `services.loghq` and so on. `config/logging.ts` and
`config/monitoring.ts` take their LogHQ and BugHQ settings from it.
`buddy hq:status` prints used, limit, period and state
for every connected service, with the upgrade link from 80% of an allowance.

ReportsHQ is the odd one out: it runs inside the app against the app's own
database, so it has no ingest or read key and meters nothing. Its entry is
`services.reportshq` with a `license` from `REPORTSHQ_LICENSE`, which
`buddy hq:status` checks offline (shape only) and never prints.
`buddy hq:connect reportshq` runs the same approval and writes the licence to
`REPORTSHQ_LICENSE`, with nothing to send or read back.

A licence-only service answers a `LicenseGrant` (`{ project, licenseKey,
dashboardUrl }`) from `provision` and leaves `authenticateReadKey` and `usage`
off its adapter. `createHqService` then mounts the two connect routes and no
usage route. `isLicenseGrant` tells the two kinds of approved answer apart.

The dashboard's Logs and Errors sections read LogHQ and BugHQ when
`config/dashboard.ts` sets `providers.logs` or `providers.errors` to
`{ driver: 'hq' }`.

In tests, `createFakeHqService()` and `fakeHqFetch()` from
`@stacksjs/testing/hq` stand in for a service: the contract routes, ingest and
the two project readers, with no port.

## Limits

- The counter is approximate by one flush interval per instance. Use a
  reservation where an exact bound matters.
- After a restart the first event per owner is decided from zero while the
  durable total loads behind it.
- This package does not create accounts, sign anyone in, or share keys between
  services.
