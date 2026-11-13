# @stacksjs/hq

What every Stacks HQ service does the same way: counting usage against a plan
allowance, the connect and usage endpoints, and the typed readers an app uses to
call a service.

The services stay separate. BugHQ, LogHQ, AnalyticsHQ, StatusHQ and CommsHQ each
keep their own accounts, keys, plans and billing; there is no central account
and no shared login. This package shares code, never identity.

It has no runtime dependencies. A database client or a store is always passed
in, so the same code runs in a service, in a test and in an app.

| Entrypoint | For |
|---|---|
| `@stacksjs/hq/meter` | a service counting usage and deciding what to accept |
| `@stacksjs/hq/service` | a service mounting the connect and usage endpoints |
| `@stacksjs/hq/client` | an app reading a service with its read key |
| `@stacksjs/hq/testing` | the contract suite and an in-memory service |

## Meter

### Counter (ingest)

```ts
import { createCounter, formatUsageHeader, sqlCounterStore, USAGE_HEADER } from '@stacksjs/hq/meter'

const counter = createCounter({ store: sqlCounterStore(db, { dialect: 'postgres' }) })

route.post('/errors', async (request) => {
  const admission = counter.admit(project.owner_id, 'errors', limits.errors)
  if (admission.accept)
    await store(event)
  // Always 2xx. A refusal would only make the SDK retry.
  return new Response(null, {
    status: 202,
    headers: { [USAGE_HEADER]: formatUsageHeader({ ...admission, upgradeUrl }) },
  })
})
```

`record` and `admit` touch memory and return; they never await and never query.
A timer folds the buffered deltas into `usage_counters` every ten seconds with an
additive upsert, so any number of instances converge on one total. A crash loses
at most one interval of counts.

The table is keyed by `(owner, meter, period)`, the period being `YYYY-MM` in
UTC. Put `usageCountersMigrationSql({ dialect })` in a migration, or call
`ensureUsageCountersTable(db)`. Nothing is created implicitly.

`admit` counts a kept event under `meter` and a dropped one under
`droppedMeter(meter)` (`errors.dropped`), so the reported usage is what was
stored while the one-in-ten sequence still advances on every event received.

### Reservation (sends)

`reserveUsage(store, meter, quantity)` and `releaseUsage(store, reservation)`
are a compare-and-set over a `UsageQuotaStore` you implement with `read` and
`compareAndSet`. They never overbook under concurrency and fail closed with
`UsageQuotaError`. To give a send its grace, store `graceCeiling(limit,
HARD_SEND)` as the snapshot's limit.

### Policy

`evaluate(used, limit, policy)` is pure. `used` includes the unit being decided.

| Policy | Up to the limit | Limit to 120% | Past 120% |
|---|---|---|---|
| `SOFT_INGEST` | `ok`, then `warn` from 80% | `over`, accepted | `sampled`, one in ten accepted |
| `HARD_SEND` | `ok`, then `warn` from 80% | `over`, accepted | `over`, refused |

`enforceQuota(meter, used, limit)` throws `QuotaExceededError` (code
`quota_exceeded`, with `meter`, `used`, `limit`, `upgradeUrl`) when a send is
refused. A `null` limit is unlimited.

### The usage header

```text
X-HQ-Usage: errors;412;500;warn;upgrade=https%3A%2F%2Fbughq.example%2Fpricing
```

`meter;used;limit;state;upgrade=<url>`. The limit is `unlimited` for an
unlimited meter and the URL is percent-encoded. `parseUsageHeader` answers
`null` for anything malformed.

## Service

```ts
// routes/hq.ts
import { createHqService, sqlConnectCodeStore } from '@stacksjs/hq/service'

const hq = createHqService({
  service: 'bughq',
  approveUrl: code => `https://bughq.example/cli/connect?code=${code}`,
  upgradeUrl: 'https://bughq.example/pricing',
  codes: sqlConnectCodeStore(db, { dialect: 'postgres' }),
  provision: (user, { app }) => createOrReuseProject(user, app),
  authenticateReadKey: key => principalForReadKey(key),
  usage: principal => [{ meter: 'errors', used: usedBy(principal.owner), limit: limitFor(principal.owner) }],
})

for (const { method, path, handler } of hq.routes)
  route[method.toLowerCase()](path, handler).skipCsrf()
```

| Route | Answer |
|---|---|
| `POST /api/cli/connect` | `201 { code, approveUrl }` |
| `GET /api/cli/connect/{code}` | `200 { status: 'pending' }`; once approved `200 { status: 'approved', project, ingestKey, readKey, dashboardUrl }`, exactly once; otherwise `404 { status: 'expired' }` |
| `GET /api/v1/usage` | `200 { meter, used, limit, period, state, upgradeUrl }[]`; `401` without a valid `Authorization: Bearer <read key>` |

A service that takes no data from the app, because its product runs inside the
app, has no keys to hand over. It answers a `LicenseGrant`
(`{ project, licenseKey, dashboardUrl }`) from `provision` and leaves
`authenticateReadKey` and `usage` off its adapter. An approved poll then
carries `licenseKey` in place of the two keys, `routes` holds the two connect
routes only, and the usage handler answers `404`.

The approve page is the service's own. It calls `hq.describeConnect(code)` to
show which app is asking and `hq.approveConnect(code, user)` when the signed-in
user confirms.

An approve link can be minted by anyone for any app name, so approving on the
link alone would let a signed-in person be talked into handing over their keys.
`confirmationCode(code)` is a six-character code derived from the connect code.
Send it as `confirmCode` beside `code` and `approveUrl` (`buddy hq:connect`
prints it), ask for it on the approve page without rendering it, and call
`approveConnect` only once `confirmationMatches(code, typed)` holds. Limit the
attempts per person.

Codes are single-use and live ten minutes (`codeTtlMs`). A store only ever sees
the SHA-256 of a code, and approved keys wait encrypted under a key derived from
the code itself, so a copy of the table yields neither a code that can be polled
nor a key. `connectCodesMigrationSql()` is the table for `sqlConnectCodeStore`.

The handlers do not rate-limit. Put a limit on `POST /api/cli/connect` in the
router.

### Contract suite

```ts
import { hqServiceContract } from '@stacksjs/hq/testing'

hqServiceContract('bughq', async () => ({ adapter, user: await signedInUser() }))
```

It covers code issue, hashing at rest, pending, approval, single use under
concurrent polls, expiry, project reuse, read-key refusal (including the ingest
key) and the usage shape. `createMemoryHqAdapter()` passes it and doubles as a
stand-in service for an app's tests.

A licence-only adapter runs the same suite. There it checks that an approved
poll carries a licence and no keys, and that the service has no usage route.

## Client

```ts
import { createHqClient } from '@stacksjs/hq/client'

const hq = createHqClient({
  services: {
    bughq: { url: env.BUGHQ_URL, readKey: env.BUGHQ_READ_KEY, project: env.BUGHQ_PROJECT },
    loghq: { url: env.LOGHQ_URL, readKey: env.LOGHQ_READ_KEY, project: env.LOGHQ_PROJECT },
  },
})

const usage = await hq.getUsage('bughq')
if (usage.ok)
  usage.data // UsageReport[]
else
  usage.reason // 'not_configured' | 'unauthorized' | 'timeout' | 'network' | 'http' | 'bad_response'
```

A reader never throws into the caller. A service that is down, slow (three
seconds by default) or not configured costs the page one panel.

### Readers and the endpoints behind them

| Reader | Status | Endpoint |
|---|---|---|
| `getUsage(service)` | implemented | `GET /api/v1/usage`, mounted from `@stacksjs/hq/service` |
| `logs.list(query)` | implemented | LogHQ `GET /api/projects/{project}/logs` with `level`, `channel`, `environment`, `trace`, `request`, `q`, `before`, `limit`; answers `{ logs, nextCursor }` |
| `issues.list(query)` | implemented | BugHQ `GET /api/projects/{project}/issues` with `status`; answers `{ issues }` |
| `AnalyticsReader.summary(query)` | interface only | AnalyticsHQ has no read-key endpoint. It needs `GET /api/v1/sites/{site}/summary?from&to` answering `{ pageviews, visitors, topPages: { path, pageviews }[] }` |
| `UptimeReader.monitors()` | interface only | StatusHQ has no read-key endpoint. It needs `GET /api/v1/monitors` answering `{ monitors: { id, name, url, status, uptimePercent, lastCheckedAt }[] }` |
| `CommsReader.summary()` | interface only | CommsHQ has no read-key endpoint. It needs `GET /api/v1/summary` answering `{ sent, delivered, bounced, contacts }` for the current period |

Both implemented project readers accept the read key as a bearer token and
answer `404` (not `401`) for a key that does not open the project, which the
client reports as `reason: 'http'` with `status: 404`.
