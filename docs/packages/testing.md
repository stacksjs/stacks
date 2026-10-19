---
title: Testing Package
description: "A comprehensive testing framework built on Bun's native test runner, providing assertions, database testing utilities, feature testing, factories, and mock..."
---
# Testing Package

A comprehensive testing framework built on Bun's native test runner, providing assertions, database testing utilities, feature testing, factories, and mocking capabilities.

## Installation

```bash
bun add @stacksjs/testing
```

## Basic Usage

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@stacksjs/testing'

describe('User', () => {
  it('should create a new user', async () => {
    const user = await User.create({ name: 'John', email: 'john@test.com' })
    expect(user.name).toBe('John')
    expect(user.email).toBe('john@test.com')
  })
})
```

## Test Structure

### Describe and It

```typescript
import { describe, it, expect } from '@stacksjs/testing'

describe('Calculator', () => {
  describe('add', () => {
    it('should add two positive numbers', () => {
      expect(add(2, 3)).toBe(5)
    })

    it('should handle negative numbers', () => {
      expect(add(-1, 1)).toBe(0)
    })
  })

  describe('divide', () => {
    it('should divide two numbers', () => {
      expect(divide(10, 2)).toBe(5)
    })

    it('should throw on division by zero', () => {
      expect(() => divide(10, 0)).toThrow('Division by zero')
    })
  })
})
```

### Lifecycle Hooks

```typescript
import { describe, it, beforeAll, beforeEach, afterAll, afterEach } from '@stacksjs/testing'

describe('Database Tests', () => {
  beforeAll(async () => {
    // Run once before all tests in this describe block
    await database.connect()
  })

  beforeEach(async () => {
    // Run before each test
    await database.beginTransaction()
  })

  afterEach(async () => {
    // Run after each test
    await database.rollback()
  })

  afterAll(async () => {
    // Run once after all tests
    await database.disconnect()
  })

  it('should insert record', async () => {
    await User.create({ name: 'John' })
    const count = await User.count()
    expect(count).toBe(1)
  })
})
```

## Assertions

### Basic Matchers

```typescript
import { expect } from '@stacksjs/testing'

// Equality
expect(value).toBe(42)           // Strict equality
expect(value).toEqual({ a: 1 })  // Deep equality
expect(value).not.toBe(0)        // Negation

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()

// Numbers
expect(value).toBeGreaterThan(5)
expect(value).toBeGreaterThanOrEqual(5)
expect(value).toBeLessThan(10)
expect(value).toBeLessThanOrEqual(10)
expect(value).toBeCloseTo(0.3, 2) // For floating point

// Strings
expect(str).toContain('hello')
expect(str).toMatch(/pattern/)
expect(str).toHaveLength(5)

// Arrays
expect(arr).toContain('item')
expect(arr).toHaveLength(3)
expect(arr).toEqual(['a', 'b', 'c'])

// Objects
expect(obj).toHaveProperty('name')
expect(obj).toHaveProperty('address.city', 'NYC')
expect(obj).toMatchObject({ name: 'John' })
```

### Exceptions

```typescript
// Expect function to throw
expect(() => throwingFunction()).toThrow()
expect(() => throwingFunction()).toThrow('error message')
expect(() => throwingFunction()).toThrow(CustomError)
expect(() => throwingFunction()).toThrow(/pattern/)

// Async throw
await expect(async () => await asyncThrow()).rejects.toThrow()
```

### Async Assertions

```typescript
// Promise resolves
await expect(promise).resolves.toBe(value)
await expect(promise).resolves.toEqual({ data: 'value' })

// Promise rejects
await expect(promise).rejects.toThrow('error')
await expect(promise).rejects.toBeInstanceOf(Error)
```

### Type Assertions

```typescript
expect(value).toBeInstanceOf(Date)
expect(value).toBeInstanceOf(CustomClass)
expect(typeof value).toBe('string')
expect(typeof value).toBe('number')
```

## Database Testing

### Using Test Database

```typescript
import { describe, expect, it } from '@stacksjs/testing'
import { useTransaction } from '@stacksjs/testing/database'

describe('User Model', () => {
  // Wrap each test in a transaction that rolls back
  useTransaction()

  it('should create user', async () => {
    const user = await User.create({ name: 'Test User', email: 'test@test.com' })
    expect(user.id).toBeDefined()

    // Automatically rolled back after test
  })
})
```

### Database Assertions

```typescript
import { assertDatabaseHas, assertDatabaseMissing } from '@stacksjs/testing/database'

it('should save user to database', async () => {
  await User.create({ name: 'John', email: 'john@test.com' })

  // Assert record exists
  await assertDatabaseHas('users', {
    email: 'john@test.com'
  })
})

it('should delete user', async () => {
  const user = await User.create({ name: 'John', email: 'john@test.com' })
  await user.delete()

  // Assert record doesn't exist
  await assertDatabaseMissing('users', {
    email: 'john@test.com'
  })
})
```

### Database Count Assertions

```typescript
import { assertDatabaseCount } from '@stacksjs/testing/database'

it('should have correct number of users', async () => {
  await User.create({ name: 'User 1' })
  await User.create({ name: 'User 2' })

  await assertDatabaseCount('users', 2)
})
```

### Soft Delete Assertions

```typescript
import { assertSoftDeleted, assertNotSoftDeleted } from '@stacksjs/testing/database'

it('should soft delete user', async () => {
  const user = await User.create({ name: 'John' })
  await user.delete() // Soft delete

  await assertSoftDeleted('users', { id: user.id })
})

it('should restore user', async () => {
  const user = await User.create({ name: 'John' })
  await user.delete()
  await user.restore()

  await assertNotSoftDeleted('users', { id: user.id })
})
```

## DynamoDB Testing

Table-level fixtures only. Point `AWS_ENDPOINT_URL` at a DynamoDB you started
yourself - DynamoDB Local, or a real region:

```typescript
import { afterAll, beforeAll } from 'bun:test'
import { createStacksTable, deleteStacksTable } from '@stacksjs/testing/dynamodb'

beforeAll(async () => {
  await createStacksTable()
})

afterAll(async () => {
  await deleteStacksTable()
})
```

There are no item assertions. The `DynamoDBClient` in `@stacksjs/ts-cloud`
covers `createTable`, `deleteTable` and `describeTable`, and no data-plane
operations, so assert against DynamoDB through whichever client your code
already uses to write to it.

## Feature Testing

### HTTP Testing

```typescript
import { describe, it, expect } from '@stacksjs/testing'

describe('API Routes', () => {
  it('should return users list', async () => {
    const response = await fetch('http://localhost:3000/api/users')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.users).toBeInstanceOf(Array)
  })

  it('should create user', async () => {
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John', email: 'john@test.com' })
    })

    expect(response.status).toBe(201)

    const data = await response.json()
    expect(data.user.name).toBe('John')
  })
})
```

### Authenticated Requests

```typescript
import { actingAs } from '@stacksjs/testing'

it('should access protected route', async () => {
  const user = await User.create({ name: 'John', email: 'john@test.com' })
  const token = await actingAs(user)

  const response = await fetch('http://localhost:3000/api/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  })

  expect(response.status).toBe(200)
})
```

## Factories

### Defining Factories

A factory is declared once, on the model, per attribute:

```typescript
// app/Models/User.ts
export default defineModel({
  name: 'User',
  attributes: {
    name: { fillable: true, factory: faker => faker.person.fullName() },
    email: { fillable: true, unique: true, factory: faker => faker.internet.email() },
    password: { fillable: true, factory: faker => faker.internet.password() },
  },
})
```

### Using Factories

```typescript
import { factory } from '@stacksjs/testing/database'

it('should create user with factory', async () => {
  // Create single record
  const user = await factory('User').create()
  expect(user.id).toBeDefined()

  // Create multiple records
  const users = await factory('User').createMany(5)
  expect(users).toHaveLength(5)

  // Create with overrides
  const admin = await factory('User').create({
    role: 'admin',
    email: 'admin@test.com'
  })
  expect(admin.role).toBe('admin')

  // Attributes only, nothing written
  const attrs = await factory('User').make({ name: 'Test User' })
  expect(attrs.name).toBe('Test User')
})
```

### Factory States

A state is an override object at the call site, not a name registered up front:

```typescript
const admin = await factory('User').create({ role: 'admin' })
const unverified = await factory('User').create({ email_verified_at: null })
```

For a state used across a file, give the object a name where you use it:

```typescript
const admin = { role: 'admin', email_verified_at: new Date() }

const one = await factory('User').create(admin)
const many = await factory('User').createMany(3, admin)
```

### Factory Relationships

`belongsTo` columns are filled automatically - the generator creates the parent
row and uses its id, because that is what `buddy seed` has to do to satisfy the
foreign key:

```typescript
// Post belongsTo User, so post.user_id points at a real row
const post = await factory('Post').create()
```

The other direction is explicit, since only the test knows how many children it
wants:

```typescript
const post = await factory('Post').create()
const comments = await factory('Comment').createMany(3, { post_id: post.id })
```

## Mocking

### Mock Functions

```typescript
import { mock, spyOn } from '@stacksjs/testing'

it('should call function with correct args', () => {
  const mockFn = mock(() => 'result')

  const result = mockFn('arg1', 'arg2')

  expect(mockFn).toHaveBeenCalled()
  expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
  expect(mockFn).toHaveBeenCalledTimes(1)
  expect(result).toBe('result')
})
```

### Spy on Methods

```typescript
it('should spy on method', () => {
  const obj = {
    method: () => 'original'
  }

  const spy = spyOn(obj, 'method')
  obj.method()

  expect(spy).toHaveBeenCalled()
})
```

### Mock Return Values

```typescript
const mockFn = mock()
  .mockReturnValue('value')
  .mockReturnValueOnce('first call')
  .mockImplementation((x) => x * 2)

expect(mockFn(5)).toBe(10)
```

### Mock Modules

```typescript
import { mock } from '@stacksjs/testing'

// Mock entire module
mock.module('@stacksjs/email', () => ({
  send: mock(() => Promise.resolve({ sent: true }))
}))

// In test
it('should send email', async () => {
  const result = await sendWelcomeEmail('user@test.com')
  expect(result.sent).toBe(true)
})
```

`mock.module()` replaces the module for the rest of the `bun test` process,
not just this file, so a later file that imports the real module gets the
mock. Run a file that mocks modules in its own process with `runIsolated`.

## Isolated Processes

`runIsolated(file, options)` runs a test file or script in a child Bun process
with its own environment, collects what it printed, and kills it if it outlives
`timeoutMs`:

```typescript
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'

it('bills a membership end to end', async () => {
  const result = await runIsolated('tests/fixtures/billing-flow.ts', {
    env: { APP_ENV: 'test', STRIPE_SECRET_KEY: undefined }, // undefined removes a variable
    timeoutMs: 45_000,
    envFile: false,  // pass --no-env-file
    preload: [],     // replace the project's bunfig preloads with none
  })
  assertIsolatedOk(result, 'billing flow OK') // throws with stdout and stderr unless it exited 0 and printed this
}, 50_000)
```

| Option | Default | Meaning |
| --- | --- | --- |
| `env` | | Variables over the parent's environment; `undefined` removes one |
| `inheritEnv` | `true` | Start from the parent's environment |
| `timeoutMs` | `60000` | SIGTERM at the timeout, SIGKILL 2 s later |
| `args` | | Arguments after the file |
| `cwd` | parent's | Working directory |
| `mode` | `'auto'` | `'test'` runs `bun test`, `'run'` runs a script; `'auto'` picks `'test'` for `*.test.*` and `*.spec.*` |
| `preload` | project's | Replace the bunfig preloads (an empty list means none) |
| `envFile` | `true` | `false` passes `--no-env-file` |
| `stdin` | | Text written to the child's stdin |

It resolves `{ code, signal, stdout, stderr, timedOut, durationMs, command }`;
`code` is null when a signal ended the child.

## Disposable Databases

`withDisposableDatabase(dialect, fn)` creates a uniquely named database, passes
it to `fn`, and drops it afterwards, even when `fn` throws:

```typescript
import { disposablePostgresUrl, runIsolated, test, withDisposableDatabase } from '@stacksjs/testing'

for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect}: orders keep their totals`, async () => {
    await withDisposableDatabase(dialect, async (database) => {
      const result = await runIsolated('tests/fixtures/orders.ts', { env: { APP_ENV: 'test', ...database.env } })
      expect(result.code, result.stdout + result.stderr).toBe(0)
    })
  }, 60_000)
}
```

- **SQLite** is a file in a fresh temporary directory; `database.env` is
  `{ DB_CONNECTION: 'sqlite', DB_DATABASE_PATH }`.
- **PostgreSQL** is created on the server named by `options.url` or
  `STACKS_TEST_POSTGRES_URL` (for example
  `postgres://postgres@127.0.0.1:5432/postgres`, a user that may `CREATE
  DATABASE`), and dropped with `DROP DATABASE ... WITH (FORCE)`, which also ends
  connections a crashed child left open. `database.env` holds `DB_CONNECTION`,
  `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD`;
  `database.url` connects to it.
- Only a server on this machine (`localhost`, `127.0.0.1`, `::1`) is accepted.
- `database.directory` is a temporary directory removed with the database, for
  fixtures or a generated bunfig.
- If `fn` throws, its error is the one you see; a failure to drop is reported
  only when `fn` succeeded.

`createDisposableDatabase(dialect, options)` returns the same object with
`drop()` and `Symbol.asyncDispose`, for a database that spans hooks:

```typescript
await using database = await createDisposableDatabase('sqlite')
```

## Browser Testing

`@stacksjs/testing/browser` drives headless Chrome over the DevTools Protocol
with no browser package: the Chrome on the machine and Bun's WebSocket.

```typescript
import { launch, navigate } from '@stacksjs/testing/browser'

const { cdp, close } = await launch()
try {
  const requests: string[] = []
  const stop = cdp.on('Network.requestWillBeSent', params => requests.push(params.request.url))
  await navigate(cdp, 'http://localhost:3000/dashboard') // waits for load and 1 s of network quiet
  expect(await cdp.evaluate('document.title')).toBe('Dashboard')
  expect(cdp.errors).toEqual([])
  stop()
}
finally {
  await close()
}
```

`launch(options)` starts a private Chrome with a temporary profile and opens a
session on its page with the `Page`, `Runtime`, `Network` and `Log` domains on.
By default it also:

- sets a 1440x1000 viewport (`viewport`);
- answers stx's live-reload stream with one that retries in a day, so a file
  saved mid-run cannot reload the page under a check (`quietLiveReload`);
- accepts JavaScript dialogs, which would otherwise block the page and every
  command, and records each in `cdp.errors` (`acceptDialogs`);
- removes "HeadlessChrome" from the user agent (`userAgent`);
- passes `--use-mock-keychain`.

`profile` keeps one profile directory across launches, for a run that must
start Chrome again part-way. `chromePath` or `CHROME_PATH` picks the binary;
otherwise `findChrome()` looks for Chrome, Chrome for Testing or Chromium.

The `Cdp` session:

| Member | |
| --- | --- |
| `send(method, params)` | A command's result; rejects on a protocol error or after `commandTimeoutMs` (30 s) |
| `evaluate(expression)` | The expression's value in the page, awaiting a promise |
| `on(method, listener)` | Adds a listener (any number per method) and returns a function that removes it |
| `off(method, listener)` | Removes one |
| `once(method, match?, timeoutMs?)` | The next matching event |
| `errors` | Uncaught exceptions, `console.error`, error log entries and failed requests |
| `inFlight` | Requests still loading. Event streams leave as soon as they open, so a page with live updates can settle |
| `closed` | Chrome went away; pending and later commands fail at once |

`settle(cdp, { quietMs, timeoutMs })` waits until the document has loaded and
no request has been in flight for `quietMs`, and resolves false rather than
throwing when the page never goes quiet. `waitFor(read, timeoutMs)` polls until
`read` returns something truthy.

### Page audits

`auditPage(url, options)` loads a page once and reports what it cost:

```typescript
import { auditPage, formatPageAudit, pageAuditClean } from '@stacksjs/testing/browser'

const report = await auditPage('http://localhost:3000/dashboard', {
  beforeNavigate: cdp => cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('auth_token', ${JSON.stringify(token)})`,
  }),
})
console.log(formatPageAudit(report)) // '/dashboard: 9 api | dup 2x GET /api/me'
expect(pageAuditClean(report)).toBe(true)
```

The report has `apiRequests`, `duplicates` (API requests made more than once),
`failed` (same-origin responses of 400 and above), `errors`, `settled` and
`durationMs`. `isApiRequest(url, method)` changes what counts as an API request
(default: paths under `/api/`, event streams excluded). Pass `cdp` to audit in
an open session, or `launch` options for the Chrome it starts. A launch or
navigation failure is reported in `errors`, never thrown. From the command line:
`buddy test:page-audit --url /,/dashboard`.

### Chrome on macOS

The installed Google Chrome quits about 30 seconds into a run while an update is
pending: GoogleUpdater sends SIGTERM to every process with Chrome's bundle id.
To a test it looks like a hung page. A renamed copy dies too; a clone with the
updater's keys removed and its own bundle id does not:

```bash
cp -cR "/Applications/Google Chrome.app" /tmp/chrome/Chrome.app
for key in KSProductID KSUpdateURL KSChannelID KSVersion; do
  /usr/libexec/PlistBuddy -c "Delete :$key" /tmp/chrome/Chrome.app/Contents/Info.plist
done
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier dev.stacks.testing.chrome" /tmp/chrome/Chrome.app/Contents/Info.plist
codesign --force --deep --sign - /tmp/chrome/Chrome.app
```

`launch()` does this itself when `CHROME_PATH` is not set and the Chrome it
found carries the updater's keys (`prepareMacChrome()`, cached per Chrome
version in the temporary directory; `stableMacChrome: false` turns it off).
Run the clone with `--use-mock-keychain`, as `launch()` does: to the Keychain it
is a new app, and its first cookie read raises a "Chrome Safe Storage" prompt
that nobody sees, behind which every http page hangs.

## Time Testing

### Freezing Time

```typescript
import { afterEach, freezeTime, travelTo, useRealTime } from '@stacksjs/testing'

// Not optional. The system clock is process-wide and bun does not roll it back
// between test files, so a frozen clock leaks into every later suite in the
// run - where it surfaces as a token that is inexplicably expired, a long way
// from the test that caused it.
afterEach(useRealTime)

it('should test time-dependent code', () => {
  // Freeze time. Pass a Date, an ISO string, or an epoch number.
  freezeTime('2024-01-15T10:00:00Z')

  const now = new Date()
  expect(now.toISOString()).toBe('2024-01-15T10:00:00.000Z')

  // Travel to a specific time; the clock stays frozen there.
  travelTo(new Date('2024-06-01'))

  const future = new Date()
  expect(future.getMonth()).toBe(5) // June
})
```

## Test Utilities

### Skip and Only

```typescript
// Skip a test
it.skip('should be skipped', () => {
  // This test won't run
})

// Run only this test
it.only('should run only this', () => {
  // Only this test runs
})

// Skip describe block
describe.skip('Skipped Suite', () => {
  // All tests skipped
})
```

### Todo Tests

```typescript
it.todo('should implement this feature')
```

### Test Timeout

```typescript
it('should complete within timeout', async () => {
  await longRunningOperation()
}, 10000) // 10 second timeout
```

## Running Tests

### CLI Commands

```bash
# Run all tests
bun test

# Run specific file
bun test tests/user.test.ts

# Run tests matching pattern
bun test --filter "User"

# Watch mode
bun test --watch

# With coverage
bun test --coverage
```

### Configuration

```typescript
// bunfig.toml
[test]
# Glob patterns for test files
preload = ["./tests/setup.ts"]
timeout = 5000
coverage = true
coverageThreshold = {
  line = 80
  function = 80
  branch = 75
}
```

## Edge Cases

### Testing Async Errors

```typescript
it('should handle async errors', async () => {
  await expect(async () => {
    await failingAsyncFunction()
  }).rejects.toThrow('Expected error')
})
```

### Testing Event Emitters

```typescript
it('should emit event', async () => {
  const emitter = new EventEmitter()
  const handler = mock()

  emitter.on('event', handler)
  emitter.emit('event', { data: 'value' })

  expect(handler).toHaveBeenCalledWith({ data: 'value' })
})
```

### Testing Race Conditions

```typescript
it('should handle concurrent operations', async () => {
  const results = await Promise.all([
    incrementCounter(),
    incrementCounter(),
    incrementCounter()
  ])

  expect(await getCounter()).toBe(3)
})
```

## API Reference

### Test Functions

| Function | Description |
|----------|-------------|
| `describe(name, fn)` | Group tests |
| `it(name, fn, timeout?)` | Define test |
| `expect(value)` | Create assertion |
| `beforeAll(fn)` | Run before all tests |
| `beforeEach(fn)` | Run before each test |
| `afterEach(fn)` | Run after each test |
| `afterAll(fn)` | Run after all tests |

### Database Assertions

| Function | Description |
|----------|-------------|
| `assertDatabaseHas(table, data)` | Assert record exists |
| `assertDatabaseMissing(table, data)` | Assert record missing |
| `assertDatabaseCount(table, count)` | Assert row count |
| `assertSoftDeleted(table, data)` | Assert soft deleted |
| `assertNotSoftDeleted(table, data)` | Assert not soft deleted |

### Matchers

| Matcher | Description |
|---------|-------------|
| `toBe(value)` | Strict equality |
| `toEqual(value)` | Deep equality |
| `toBeTruthy()` | Truthy value |
| `toBeFalsy()` | Falsy value |
| `toBeNull()` | Is null |
| `toBeUndefined()` | Is undefined |
| `toBeDefined()` | Is defined |
| `toContain(item)` | Contains item |
| `toHaveLength(n)` | Has length n |
| `toThrow(msg?)` | Throws error |
| `toBeInstanceOf(class)` | Instance of class |
| `toHaveProperty(key)` | Has property |
| `toMatchObject(obj)` | Partial object match |

### Mock Functions

| Method | Description |
|--------|-------------|
| `mock(fn?)` | Create mock function |
| `spyOn(obj, method)` | Spy on method |
| `mockReturnValue(val)` | Set return value |
| `mockImplementation(fn)` | Set implementation |
| `toHaveBeenCalled()` | Was called |
| `toHaveBeenCalledWith(...args)` | Called with args |
| `toHaveBeenCalledTimes(n)` | Called n times |
