import { namedTestPaths, runTestSuites } from './runner'

// The runner launches Bun with file isolation so globals and module mocks do
// not leak between files, while Buddy keeps its own module graph.
//
//  - `--timeout 30000` raises the default 5s per-test/hook budget. Cold-cache
//    `await import('@stacksjs/database')` inside test fixtures' `beforeAll`
//    can take 1-3s on first run; 5s gave a flaky margin where the framework
//    had loaded once but the test runner loaded it again for each file.
//
// The project-wide filter intentionally includes root-level tests as well as
// feature, integration, and unit suites.
await runTestSuites([''], 30000, namedTestPaths())
