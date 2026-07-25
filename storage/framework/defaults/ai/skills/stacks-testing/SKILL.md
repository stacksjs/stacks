---
name: stacks-testing
description: Use when writing or running tests in Stacks — test setup, database test utilities (setup, refresh, truncate), DynamoDB testing, feature test patterns, the test CLI commands, test configuration in bunfig.toml, or test environment setup. Covers @stacksjs/testing and tests/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Testing

Uses Bun's built-in test runner with Stacks-specific test utilities.

## Key Paths
- Core package: `storage/framework/core/testing/src/`
- Test directory: `tests/`
- Test setup: `tests/setup.ts`
- Package: `@stacksjs/testing`

## Test Setup

```typescript
import { setupTestEnvironment, setupDatabase, refreshDatabase } from '@stacksjs/testing'

// Set NODE_ENV and APP_ENV to 'test'
setupTestEnvironment()

// Create testing database (SQLite: database/stacks_testing.sqlite)
await setupDatabase()

// Refresh database (drop and re-migrate)
await refreshDatabase()

// Truncate tables
await truncateSqlite()   // for SQLite
await truncateMysql()    // for MySQL
```

## DynamoDB Testing

```typescript
import { launchServer, createStacksTable, deleteStacksTable, delay } from '@stacksjs/testing'

// Launch DynamoDB Local
const { server, endpoint } = await launchServer()

// Create test table
await createStacksTable()

// Cleanup
await deleteStacksTable()

// Utility
await delay(1000)  // wait for async operations
```

## Writing Tests

```typescript
import { describe, test, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test'

describe('User Model', () => {
  beforeAll(async () => {
    await setupDatabase()
  })

  afterAll(async () => {
    await refreshDatabase()
  })

  test('can create a user', async () => {
    const user = await User.create({ name: 'John', email: 'john@test.com' })
    expect(user.name).toBe('John')
  })

  test('validates email uniqueness', async () => {
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

## CLI Commands

```bash
buddy test                    # run all tests
buddy test --unit             # unit tests only
buddy test --feature          # feature tests only
bun run test                  # via npm script
bun run test:ui               # UI tests
bun run test:coverage         # with coverage
bun run test:types            # type tests
```

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
- `refreshDatabase()` drops ALL tables — use in test setup only
- DynamoDB Local must be installed for DynamoDB tests
- Queue testing uses `fake()`/`restore()` pattern — affects global state
- `@stacksjs/faker` provides test data generation
- Coverage reports with `bun run test:coverage`
