---
name: stacks-testing
description: Use when writing or running tests in a Stacks application — unit tests, integration tests, test utilities, or test configuration. Covers @stacksjs/testing and the tests/ directory.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Testing

The `@stacksjs/testing` package provides the testing framework for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/testing/src/`
- Test directory: `tests/`
- Test setup: `tests/setup.ts`
- Package: `@stacksjs/testing`

## Architecture
- Tests are in the `tests/` directory
- Test setup/preload configured in `bunfig.toml`: `preload = ["./tests/setup.ts"]`
- Uses Bun's built-in test runner

## CLI Commands
- `buddy test` or `bun run test` - Run tests
- `bun run test:ui` - Run UI tests
- `bun run test:coverage` - Run with coverage
- `bun run test:types` - Run type tests

## Configuration
- Test preload in `bunfig.toml`
- Test setup in `tests/setup.ts`

## Usage
```typescript
import { describe, it, expect } from '@stacksjs/testing'
```

## Gotchas
- Uses Bun's native test runner, not Jest or Vitest
- Test setup runs before each test file via preload
- Coverage reports are generated with `test:coverage`
- Type tests verify TypeScript types are correct
- Use `@stacksjs/faker` for generating test data
