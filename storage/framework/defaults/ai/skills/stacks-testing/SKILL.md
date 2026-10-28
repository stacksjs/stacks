---
name: stacks-testing
description: Use when writing or running tests in Stacks - test setup, database test utilities (setup, refresh, truncate), disposable SQLite/Postgres databases, running a test in an isolated child process, headless Chrome browser tests and page audits, DynamoDB testing, feature test patterns, the test CLI commands, test configuration in bunfig.toml, or test environment setup. Covers @stacksjs/testing and tests/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Testing

Uses Bun's built-in test runner with Stacks-specific test utilities.

This skill is the **mechanics**: the utilities, the setup, the CLI, the gotchas.
`stacks-tdd` is the **discipline**: the red-green loop, which seam a test belongs
at, and the anti-patterns that make a test worse than no test. Read that one
before deciding what to test, and this one for how.

## Key Paths
- Core package: `storage/framework/core/testing/src/`
- Test directory: `tests/`
- Test setup: `tests/setup.ts`
- Package: `@stacksjs/testing`

## Test Setup

```typescript
import { setupTestEnvironment } from '@stacksjs/testing'
import { refreshDatabase, setupDatabase, truncateMysql, truncateSqlite } from '@stacksjs/testing/database'

// Set NODE_ENV and APP_ENV to 'test'
setupTestEnvironment()

// MySQL database setup; this helper does not initialize SQLite
await setupDatabase()

// Reset the configured test database, including the SQLite reset path
await refreshDatabase()

// Truncate tables
await truncateSqlite()   // for SQLite
await truncateMysql()    // for MySQL
```

The database subpath is intentional. Importing its fixtures from the root
would eagerly load the database graph during test preload and can deadlock
module loading. Set the test environment before database work and confirm the
configured database points at disposable test data. `refreshDatabase()` follows
the active configured driver; it is not a generic PostgreSQL reset utility.

## DynamoDB Testing

Point `AWS_ENDPOINT_URL` at a DynamoDB you started yourself - DynamoDB Local, or
a real region. The framework cannot start one for you; a `launchServer()` that
claimed to did not work and has been removed.

```typescript
import { createStacksTable, deleteStacksTable } from '@stacksjs/testing/dynamodb'

// Create test table
await createStacksTable()

// Cleanup
await deleteStacksTable()
```

These are table-level only. There are no item assertions (`assertDynamoHas` and
friends have never existed): the `DynamoDBClient` in `@stacksjs/ts-cloud` covers
`createTable` / `deleteTable` / `describeTable` and no data-plane operations.

## Writing Tests

```typescript
import { describe, test, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing/database'

describe('User Model', () => {
  beforeAll(async () => {
    await refreshDatabase()
  })

  afterAll(async () => {
    await refreshDatabase()
  })

  test('can create a user', async () => {
    const user = await User.create({ name: 'John', email: 'john@test.com' })
    expect(user.name).toBe('John')
  })

  test('validates email uniqueness', async () => {
    await User.create({ name: 'First', email: 'duplicate@test.com' })
    await expect(User.create({ email: 'duplicate@test.com' }))
      .rejects.toThrow()
  })
})
```

## Queue Testing

```typescript
import { fake, restore, runTestJob, expectJobToFail } from '@stacksjs/queue'

test('dispatches welcome email job', async () => {
  const fakeQueue = fake()
  await SendWelcomeEmail.dispatch({ email: 'test@test.com' })
  fakeQueue.assertDispatched('SendWelcomeEmail')
  restore()
})
```

## HTTP, identity and boundary assertions

`http` is a stateless client that calls the real in-process router pipeline.
Wrap request bodies in its options. `featureTest()` returns a fluent client
whose verb helpers instead accept a bare body. Both return response wrappers
with status/headers, reusable JSON reads, `assertStatus`, `assertHeader` and
`assertJson` (a top-level partial-object comparison).

```ts
import { http, actingAs } from '@stacksjs/testing'

const response = await http.post('/api/posts', {
  body: { title: 'Hello' },
  actingAs: user,
})
response.assertStatus(201)
await response.assertJson({ title: 'Hello' })

const client = actingAs(user)
await client.post('/api/posts', { title: 'Another post' })
```

`actingAs` requires a persisted user with a numeric id. It mints a real token
through `Auth.loginUsingId`; it does not use a test-only authentication header.
An explicit Authorization header wins over the acting identity. `http` supports
query objects, repeated array query values, and multipart `formData`. A request
has either JSON `body` or `formData`, never both.

Database assertions and factory/transaction setup are imported from
`@stacksjs/testing/database`: `assertDatabaseHas`, `assertDatabaseMissing`,
`assertDatabaseCount`, `assertSoftDeleted`, `assertNotSoftDeleted`, `factory`,
`useTransaction` and `useTransactionalTests`. Read their driver conditions
before choosing transaction isolation for a suite. Database reset and clock
state are process-wide boundaries; avoid parallel tests that share them.

## Fakes, time and CLI tests

The lightweight root also exports:

- `eventFake`, `getDispatchedEvents`, `hasDispatchedEvent`, `restoreEvents`.
  Event faking suppresses real listeners and automatically restores after each
  test. Use separate listener tests for its side effects.
- `mailFake`, `sentEmails`, `lastEmail`, `emailsTo`, `restoreMail`. These route
  the real mail singleton through the capture driver and restore automatically.
- `freezeTime`, `travelTo`, `useRealTime`. Explicitly register
  `afterEach(useRealTime)`; frozen time is not restored implicitly.
- `command(args)` returns an awaitable child-process builder with `withInput`,
  `withEnv`, `withCwd` and `withTimeout`. Assert exitCode/output/timedOut. Run
  file-writing commands in a disposable fixture project using `withCwd`.

```ts
import { afterEach, freezeTime, useRealTime, command } from '@stacksjs/testing'

afterEach(useRealTime)
freezeTime('2026-01-15T10:00:00Z')
const result = await command(['list']).withTimeout(10_000)
expect(result.exitCode).toBe(0)
```

Retained implementation evidence lives under `core/testing/tests/`:
`http-client`, `acting-as`, `database-assertions`, `events`, `mail`, `time`,
`console`, `isolated`, `disposable-database`, `browser` and `declarations` (what dtsx
publishes for `browser.ts` / `isolated.ts`: no `unknown` fields) test files. Fixture mechanics live in `core/testing/src/`;
`package.json` declares the root and database/DynamoDB/browser export boundaries.

## Isolated processes and disposable databases

`bun test` runs every file in one process, and `mock.module()` replaces a
module for the rest of that run, so a mock in one file leaks into the next. A
framework booted against one database also stays booted. When a test needs a
clean process, run it in a child (`src/isolated.ts`); when it needs real rows,
give it a database nobody else uses (`src/disposable-database.ts`). Both are on
the root, with no framework import.

```ts
import { assertIsolatedOk, disposablePostgresUrl, runIsolated, test, withDisposableDatabase } from '@stacksjs/testing'

for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect} checkout flow`, async () => {
    await withDisposableDatabase(dialect, async (database) => {
      const result = await runIsolated('tests/fixtures/checkout-flow.ts', {
        env: { APP_ENV: 'test', ...database.env },
        timeoutMs: 45_000,
        envFile: false,      // --no-env-file
        preload: [],         // replace bunfig preloads (none); or bunfig: 'tests/isolated/bunfig.toml'
      })
      assertIsolatedOk(result, 'checkout flow OK') // throws with stdout + stderr otherwise
    })
  }, 50_000)
}
```

- `runIsolated(file, { env, timeoutMs = 60_000, args, cwd, mode, preload, bunfig, envFile, inheritEnv, stdin })`
  resolves `{ code, signal, stdout, stderr, timedOut, durationMs, command }`. `mode: 'auto'` runs
  `*.test.*` / `*.spec.*` with `bun test`, anything else as a script; `env` values of `undefined`
  remove a variable. The watchdog sends SIGTERM at the timeout and SIGKILL 2 s later.
- `bunfig: 'path/bunfig.toml'` runs the child with that config (`--config=`), resolved against
  `cwd`; it must exist. `preload` instead generates a config holding only those preloads. They are
  exclusive (a TypeError): list the preloads in your bunfig. Bun resolves a bunfig's relative
  `preload` paths against the child's cwd, not the bunfig's directory.
- `withDisposableDatabase(dialect, fn, { url?, prefix? })`: SQLite is a file in a fresh temp
  directory; Postgres is `CREATE DATABASE` on `url` or `STACKS_TEST_POSTGRES_URL`, dropped with
  `DROP DATABASE ... WITH (FORCE)` after `fn`, even when it throws (the test's error wins over a
  cleanup error). Only `localhost`, `127.0.0.1` and `::1` are accepted. `database.env` holds the
  `DB_*` variables (`DB_CONNECTION`, `DB_DATABASE_PATH` or `DB_HOST`/`DB_PORT`/`DB_DATABASE`/
  `DB_USERNAME`/`DB_PASSWORD`); `database.directory` is removed with it.
- `createDisposableDatabase` returns the same with `drop()` and `Symbol.asyncDispose`
  (`await using`), for setups that span hooks.

## Browser tests: `@stacksjs/testing/browser`

Headless Chrome over the DevTools Protocol with no browser package: the installed
Chrome and Bun's WebSocket (`src/browser.ts`). A subpath so tests that never drive
a browser never load it.

```ts
import { auditPage, launch, navigate, pageAuditClean, settle } from '@stacksjs/testing/browser'

const { cdp, close } = await launch({ viewport: { width: 390, height: 844, mobile: true } })
try {
  const off = cdp.on('Network.requestWillBeSent', params => requests.push(params.request.url))
  await navigate(cdp, 'http://localhost:3000/dashboard')   // settles: loaded + network quiet 1 s
  expect(await cdp.evaluate('document.title')).toBe('Dashboard')
  expect(cdp.errors).toEqual([])                          // exceptions, console.error, failed requests, dialogs
  off()
}
finally { await close() }

const report = await auditPage('http://localhost:3000/pricing') // launches its own Chrome, or pass { cdp }
expect(pageAuditClean(report)).toBe(true) // no duplicate /api/ requests, failed same-origin requests or errors
```

- `Cdp`: `send`, `evaluate`, `on(method, fn)` (any number of listeners per method; returns an
  unsubscribe), `off`, `once(method, match?, timeoutMs?)`, `intercept(patterns, handler)`,
  `errors`, `inFlight: Map<requestId, 'METHOD url'>` (event streams leave it when their response
  starts, so a page with live updates can still settle), `closed` (every pending command fails at
  once when Chrome goes away).
- `launch(options)` enables Page/Runtime/Network/Log, sets a 1440x1000 viewport, answers stx's
  live-reload stream (`*/_stx/hmr*`) with a day-long retry so a save mid-run cannot reload the
  page, accepts JavaScript dialogs and records them in `errors`, removes "HeadlessChrome" from the
  user agent, and passes `--use-mock-keychain`. `profile` keeps one profile across relaunches.
- **One Chrome per process, a browser context per `launch()`**: same executable, headless mode
  and `args` share the process; each launch gets its own cookies, storage, cache and service
  workers (`Network.clearBrowserCookies` clears only its own). `close()` disposes the context and
  the Chrome lingers 1.5 s for the next launch; `closeSharedBrowsers()` stops it now. `profile`,
  `shared: false` or `STACKS_BROWSER_SHARED=0` get a Chrome of their own.
- **Pausing requests next to live reload.** Chrome keeps one `Fetch.enable` pattern set per
  session (a second call replaces it, `Fetch.disable` drops all) and sends every paused request to
  every listener, so the session layers them. `await cdp.intercept([{ urlPattern: '*/api/slow*' }],
  (paused, cdp) => ...)` hands a handler only what its own patterns match and resolves with an
  async remover; `quietLiveReload(cdp, patterns?)` is one (what `launch()` runs). Your own
  `cdp.send('Fetch.enable' | 'Fetch.disable')` sets one more layer and the session enables the
  union, so a journey that holds its own request needs no `quietLiveReload: false`.
  `on('Fetch.requestPaused')` listeners see the requests your patterns match, not the live-reload
  stream. The first answer wins: a second `continueRequest`/`fulfillRequest`/`failRequest` for one
  pause resolves without reaching Chrome. A pause nobody could answer is continued; one your own
  pattern holds with no listener stays held (a hanging request on purpose).
  `matchesUrlPattern(pattern, url)` and `pausedRequestMatches(pattern, paused)` are Chrome's
  matching rules (`*`, `?`, `\` escape; stage and resource type).
- `settle(cdp, { quietMs, timeoutMs })` resolves false (not throws) when a page never goes quiet.
- `click(cdp, selector | { selector, text }, { timeoutMs? })` scrolls the unique target into view,
  waits for layout, enabled state and an unobscured hit test, then uses Chrome's real mouse input.
  Use it for journey controls instead of local coordinate-click helpers or DOM-dispatched clicks.
- `auditPage(url, { cdp?, launch?, viewport?, isApiRequest?, beforeNavigate?, pageLoads?, quietMs, timeoutMs })`
  returns `{ url, finalUrl, apiRequests, duplicates, loads, failed, errors, settled, durationMs }`
  and never throws for a page problem. `beforeNavigate` is where to seed a token
  (`Page.addScriptToEvaluateOnNewDocument`). `formatPageAudit(report)` prints one line, with
  `/today -> /home` when the page landed elsewhere.
- Duplicates are counted **per page load**: a page that sends you on (`/today` replacing itself with
  `/home`) is two loads, so `/api/me` once in each is not a duplicate. A load starts with each new
  main-frame document after the first and each same-document (history API) navigation to a
  different path; a query or hash change stays in the load. `loads` lists them
  (`{ url, apiRequests, duplicates }`), `duplicates` is the highest count any one load reached,
  `finalUrl` is `location.href` once settled. `pageLoads: 'visit'` counts the whole visit as one
  load (the old behaviour). `splitPageLoads(url, events, mode)` and `loadDuplicates(loads)` are the
  pure logic. `finalUrl` and `loads` are optional on the type, so hand-built reports still compile.
- **macOS: the installed Chrome quits about 30 s in.** GoogleUpdater SIGTERMs every process with
  Chrome's bundle id while an update is pending; to a test that looks like a hung page. When
  `CHROME_PATH` is not set, `launch()` runs `prepareMacChrome()`: a `cp -cR` clone in the temp
  directory with the `KS*` updater keys deleted from `Info.plist`, its own `CFBundleIdentifier`,
  and `codesign --force --deep --sign -`, reused per Chrome version. `--use-mock-keychain` is what
  keeps that clone from hanging on an invisible "Chrome Safe Storage" Keychain prompt at its first
  http page. Measured: the installed Chrome closed at 32 s, the clone kept navigating past 60 s.
- The package's own real-Chrome tests (`core/testing/tests/browser.test.ts`) run wherever a Chrome
  is found, except in CI unless `STACKS_BROWSER_TESTS=1`; `STACKS_BROWSER_TESTS=0` skips them locally.

## CLI Commands

```bash
buddy test                    # run all tests
buddy test --unit             # unit tests only
buddy test --feature          # feature tests only
buddy test tests/unit/auth.test.ts                      # just that file
buddy test storage/framework/core/scheduler/tests       # just that directory
bun run test                  # via npm script
bun run test:ui               # UI tests
bun run test:coverage         # with coverage
bun run test:types            # type tests
buddy test:page-audit --url /,/dashboard --base http://localhost:3000  # duplicate API requests, failures, console errors
buddy test:page-audit --url http://localhost:3000/pricing --mobile --json
```

Name a path to run only what is under it, file or directory, anywhere in the
repo. A path matching no test file is an error rather than a fallback to the
whole suite, which matters because the fallback used to report `0 fail` and
exit 0 for a file it never opened. `test:unit` and `test:feature` narrow a
named path to their own suite and say so when it holds none of their tests.

Running `bun test` directly needs the `./` prefix: bunfig sets
`[test] root = "tests"`, so `bun test storage/.../foo.test.ts` from the repo
root matches nothing and reports a clean run over no files, while
`bun test ./storage/.../foo.test.ts` works. `buddy test` adds the prefix for
you, so prefer it.

`test:page-audit` exits 1 when any page has duplicates, failed same-origin requests or errors, or
never settles.

## Configuration (bunfig.toml)

```toml
[test]
preload = ["./tests/setup.ts"]
```

## Test File Conventions
- Test files: `*.test.ts` or `*.spec.ts`
- Located in `tests/` directory
- Setup/teardown in `tests/setup.ts`
- Unit tests in `tests/unit/`
- Feature tests in `tests/feature/`

## Gotchas
- Uses Bun's native test runner, NOT Jest or Vitest
- Test preload runs `tests/setup.ts` before each test file
- SQLite testing database is at `database/stacks_testing.sqlite`
- `refreshDatabase()` drops ALL tables - use in test setup only
- DynamoDB Local must be installed for DynamoDB tests
- Queue testing uses `fake()`/`restore()` pattern - affects global state
- `@stacksjs/faker` provides test data generation
- Coverage reports with `bun run test:coverage`

## Downstream

> Deciding what to test, or where? `/stacks-tdd`. Reviewing someone else's
> tests? `/stacks-review` audits coverage as its third pass.
