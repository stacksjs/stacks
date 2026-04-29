import process from 'node:process'
import { log } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

// Test runner shells out to `bun test` rather than running tests in-process so
// each test file gets a fresh module graph (no leakage between suites).
//
//  - `--timeout 30000` raises the default 5s per-test/hook budget. Cold-cache
//    `await import('@stacksjs/database')` inside test fixtures' `beforeAll`
//    can take 1-3s on first run; 5s gave a flaky margin where the framework
//    had loaded once but the test runner spun a fresh subprocess per file
//    and re-paid the cost.
//
//  - The glob list includes `./tests/integration/**` so that suite ships
//    alongside `feature/` + `unit/` instead of being silently ignored.
const proc = Bun.spawn(
  ['sh', '-c', 'bun test --timeout 30000 ./tests/feature/** ./tests/integration/** ./tests/unit/**'],
  {
    cwd: projectPath(),
    stdio: ['inherit', 'inherit', 'inherit'], // Inherit stdio to see the output in the console
  },
)

const exitCode = await proc.exited

if (exitCode !== 0) {
  log.error('Tests failed')
  process.exit(exitCode ?? 1)
}
