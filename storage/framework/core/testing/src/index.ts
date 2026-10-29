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
// Clock control (stacksjs/stacks#2581). No database dependency, so unlike the
// fixtures it is safe at the root.
export * from './console'
// Event fakes (stacksjs/stacks#2581). `@stacksjs/events` is a leaf package with
// no database dependency, so unlike the fixtures it is safe at the root.
export * from './events'
// Mail fakes (stacksjs/stacks#2581), on top of the email package's capture driver.
export * from './mail'
export * from './time'
// Child-process isolation and throwaway databases. Bun and node only, no
// framework import, so both are safe at the root.
export * from './isolated'
export * from './disposable-database'
export * from './schema'
export * from 'bun:test'

// The headless-Chrome kit is a subpath, '@stacksjs/testing/browser': most tests
// never drive a browser, and it should not be loaded for them.
//
// dynamodb utilities are not re-exported here: they talk to a real DynamoDB and
// most tests do not. Import directly from '@stacksjs/testing/dynamodb'.
