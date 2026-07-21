import { runTestSuites } from './runner'

// Test runner shells out to `bun test` rather than running tests in-process so
// each test file gets a fresh module graph (no leakage between suites).
//
//  - `--timeout 30000` raises the default 5s per-test/hook budget. Cold-cache
//    `await import('@stacksjs/database')` inside test fixtures' `beforeAll`
//    can take 1-3s on first run; 5s gave a flaky margin where the framework
//    had loaded once but the test runner spun a fresh subprocess per file
//    and re-paid the cost.
//
// The project-wide filter intentionally includes root-level tests as well as
// feature, integration, and unit suites.
await runTestSuites([''], 30000)
