---
title: Testing Overview
description: "Stacks provides a powerful, batteries-included testing framework built on besting. Write expressive tests with a familiar Jest/Vitest-like syntax while lev..."
---
# Testing

Stacks provides a powerful, batteries-included testing framework built on [besting](https://github.com/stacksjs/besting). Write expressive tests with a familiar Jest/Vitest-like syntax while leveraging Bun's native test runner for maximum performance.

## Overview

Stacks testing supports:

- **Unit Tests** - Test individual functions and classes
- **Feature Tests** - Test application features and workflows
- **HTTP Tests** - Test API endpoints and responses
- **Browser Tests** - Test UI interactions with virtual DOM
- **Database Tests** - Test database operations with automatic cleanup

## Quick Start

### Running Tests

```bash
# Run all tests
buddy test

# Run specific test types
buddy test:unit
buddy test:feature
buddy test:types
```

### Writing Your First Test

Create a test file in `tests/`:

```typescript
// tests/Unit/ExampleTest.ts
import { describe, expect, it } from 'bun:test'

describe('Example', () => {
  it('should work', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle async operations', async () => {
    const result = await Promise.resolve('hello')
    expect(result).toBe('hello')
  })
})
```

## Test Structure

### Directory Organization

```
tests/
├── Unit/           # Unit tests for functions and classes
├── Feature/        # Feature tests for workflows
├── Browser/        # Browser/UI tests
├── fixtures/       # Test fixtures and data
└── setup.ts        # Global test setup
```

### Test File Naming

- Unit tests: `tests/Unit/[Name]Test.ts`
- Feature tests: `tests/Feature/[Name]Test.ts`
- Browser tests: `tests/Browser/[Name]Test.ts`

## Assertions

### Basic Assertions

```typescript
import { expect } from 'bun:test'

// Equality
expect(value).toBe(expected)          // Strict equality
expect(value).toEqual(expected)       // Deep equality
expect(value).not.toBe(unexpected)    // Negation

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()

// Numbers
expect(num).toBeGreaterThan(5)
expect(num).toBeGreaterThanOrEqual(5)
expect(num).toBeLessThan(10)
expect(num).toBeLessThanOrEqual(10)
expect(num).toBeCloseTo(0.3, 5)       // Floating point

// Strings
expect(str).toContain('substring')
expect(str).toMatch(/pattern/)
expect(str).toHaveLength(5)

// Arrays
expect(arr).toContain(item)
expect(arr).toHaveLength(3)
expect(arr).toEqual([1, 2, 3])

// Objects
expect(obj).toHaveProperty('key')
expect(obj).toHaveProperty('key', 'value')
expect(obj).toMatchObject({ partial: 'match' })

// Exceptions
expect(() => throwingFn()).toThrow()
expect(() => throwingFn()).toThrow('message')
expect(() => throwingFn()).toThrow(CustomError)

// Async
await expect(asyncFn()).resolves.toBe(value)
await expect(asyncFn()).rejects.toThrow()
```

## Test Lifecycle

### Setup and Teardown

```typescript
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'bun:test'

describe('MyFeature', () => {
  beforeAll(async () => {
    // Run once before all tests
    await setupDatabase()
  })

  afterAll(async () => {
    // Run once after all tests
    await cleanupDatabase()
  })

  beforeEach(() => {
    // Run before each test
    resetState()
  })

  afterEach(() => {
    // Run after each test
    clearMocks()
  })

  it('test case', () => {
    // ...
  })
})
```

## Configuration

### Test Configuration

Tests are configured in `bunfig.toml`, not in a Stacks config file - `bun test`
reads it directly:

```toml
[test]
# Where the tests are. Without this, `bun test` walks the whole project,
# `pantry/` included, and runs out of file descriptors following its symlinks.
root = "tests"

# Tests get the same env layer as production boot, so encrypted .env values
# resolve during the suite rather than through a test-only decrypt path.
preload = [
  "./storage/framework/core/env/plugin.ts",
  "./tests/setup.ts",
]

coverage = false
```

Per-run settings are flags rather than config: `--timeout`, `--coverage`,
`--bail`, `-t <pattern>`. See `bun test --help`.

A package under `storage/framework/core/*` with tests of its own carries its
own `bunfig.toml` and is unaffected by the root one.

### Environment Variables

Tests run with `NODE_ENV=test`. Create a `.env.test` file for test-specific environment variables:

```bash
# .env.test
DATABASE_URL=sqlite://./test.db
CACHE_DRIVER=memory
QUEUE_DRIVER=sync
```

## Related Documentation

- **[Unit Tests](/testing/unit-tests)** - Writing unit tests
- **[Feature Tests](/testing/feature-tests)** - Testing application features
- **[HTTP Tests](/testing/http-tests)** - Testing API endpoints
- **[Database Testing](/testing/database)** - Database test utilities
- **[Mocking](/testing/mocking)** - Mocking dependencies

## Related Libraries

- **[besting](https://github.com/stacksjs/besting)** - The underlying test framework
- **[ts-mocker](https://github.com/stacksjs/ts-mocker)** - Generate fake data for tests
