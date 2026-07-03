/**
 * Regression coverage: `ensureConfigLoaded()` (`../src/utils.ts`) must wait
 * for `@stacksjs/config`'s `overridesReady` before locking in the database
 * connection config.
 *
 * Previously it called `initializeDbConfig(config)` immediately after the
 * dynamic `import('@stacksjs/config')` settled, without awaiting
 * `overridesReady` — the promise that signals the project's own
 * `~/config/database.ts` has actually finished loading. `config.database`
 * is a Proxy read that falls back to the framework default until that
 * happens, so a fast reader (e.g. a one-off `bun -e` script, or a CLI
 * command issuing its first query very early in boot) could observe the
 * framework's default connection settings instead of the project's real
 * override — and since `dbConfig`/`_dbInstance` are only reset from inside
 * `initializeDbConfig` itself, the wrong config stuck for the rest of the
 * process.
 *
 * `overridesReady` is pinned to a `globalThis` symbol and resolves at most
 * once per process (see `overrides.ts`), so the race can't be reproduced by
 * importing `../src/utils` directly from this file — by the time any test
 * body runs, config has already settled from an earlier import in the
 * shared `bun test` module registry. The fixture below runs in a fresh
 * subprocess and pre-seeds those same `globalThis` anchors to simulate a
 * slow-loading project config override under our control.
 */

import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import process from 'node:process'

const fixture = join(import.meta.dir, 'fixtures/slow-project-config-race.ts')
// Run from inside the package tree, NOT the repo root — the root
// `bunfig.toml`'s top-level `preload` boots the full framework (including
// the real `@stacksjs/config`), which would populate the real
// `overrides`/`overridesReady` globals before the fixture gets a chance to
// seed its fake ones.
const packageRoot = join(import.meta.dir, '..')

describe('ensureConfigLoaded / overridesReady race', () => {
  test('waits for overridesReady before locking in the database config', async () => {
    // `process.execPath` (not the literal `'bun'`) so this works even when
    // `bun` isn't on $PATH (e.g. sandboxed dev environments) — it always
    // points at the exact binary currently running this test.
    const proc = Bun.spawn([process.execPath, fixture], {
      cwd: packageRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    expect(exitCode, `fixture stderr:\n${stderr}`).toBe(0)

    const lines = stdout.trim().split('\n')
    const { resolvedSqlitePath } = JSON.parse(lines[lines.length - 1]!) as { resolvedSqlitePath: string }

    // Pre-fix, this would be the framework's default sqlite path
    // (`userDatabasePath('stacks.sqlite')`) — captured while `overrides`
    // still held the empty `{}` placeholder — instead of the project's
    // configured override the fixture lands 500ms after boot.
    expect(resolvedSqlitePath).toBe('/project/configured.sqlite')
  })
})
