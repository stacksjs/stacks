// Lightweight test surface — `bun:test` re-exports + `setupTestEnvironment`.
//
// The database fixture helpers (`setupDatabase`, `refreshDatabase`,
// `truncateMysql`, …) used to be re-exported from this root entry too,
// but importing them eagerly drags in `@stacksjs/database`, which has
// a self-import cycle through its `./drivers/*` re-exports that
// deadlocks bun's module loader (60s @ 99% CPU) when imported outside
// the framework's preloader context (e.g. by `bun test`'s preload).
//
// The vast majority of tests don't need the database fixtures — they
// just want `describe / test / expect / beforeAll / afterAll` and
// `setupTestEnvironment()` to flip APP_ENV. So the database helpers
// are now opt-in via the package's `./database` subpath export
// (already declared in package.json's `exports`):
//
//   import { setupDatabase, refreshDatabase } from '@stacksjs/testing/database'
//
// Tests that don't need them get a fast, hang-free import from
// '@stacksjs/testing'.
export * from './feature'
export * from 'bun:test'

// dynamodb utilities are not re-exported here because they require
// @stacksjs/cache's dynamoDbTool which has been removed. Import
// directly from '@stacksjs/testing/dynamodb' if needed.
