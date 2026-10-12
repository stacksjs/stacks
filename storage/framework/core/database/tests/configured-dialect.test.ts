import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Which driver the generated SQL is for (stacksjs/stacks#2897).
 *
 * Nine modules used to answer that privately, each with its own
 * `getDbDriver()` reading `DB_CONNECTION`, so an application that configured
 * `database.default` got the connection it configured and DDL for whatever its
 * environment happened to say. `resolvedDatabaseDriver()` in `src/dialect.ts`
 * is now the only answer, and it prefers the configured driver.
 */

const src = join(import.meta.dir, '..', 'src')
const transpiler = new Bun.Transpiler({ loader: 'ts' })

/**
 * The files allowed to read `DB_CONNECTION`, and why. Anything else asking the
 * environment directly is the bug coming back.
 */
const ALLOWED: Record<string, string> = {
  'dialect.ts': 'owns resolvedDatabaseDriver, the one place this question reads the environment',
  'utils.ts': 'seeds the open connection own driver, and compares DB_CONNECTION against the dialect for bun-query-builder URL short-circuit',
  'ensure-database.ts': 'opens the maintenance connection before any application config exists',
  'database.ts': 'Database.fromEnv() is named for the environment',
  'driver-config.ts': 'builds the environment baseline that an application config is merged over',
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? sources(full) : full.endsWith('.ts') ? [full] : []
  })
}

/**
 * Files that read `DB_CONNECTION` off some env object, with comments stripped.
 *
 * Stripping is load-bearing here in a way it is not for an ordinary assertion:
 * this is a ban, and the prose explaining the ban names the variable it bans.
 * Left in, every file carrying that explanation would read as an offender, and
 * a real read sitting beside its own excuse would read as allowed.
 *
 * The leading dot is what separates a read from a mention: the migration
 * runner's error messages say `Set DB_CONNECTION=postgres` in a string
 * literal, which survives stripping and is not a read.
 */
function readsEnvironmentDriver(file: string): boolean {
  return /\.DB_CONNECTION\b/.test(transpiler.transformSync(readFileSync(file, 'utf8')))
}

describe('the configured driver is the one answer', () => {
  test('no module resolves the driver from the environment on its own', () => {
    const offenders = sources(src)
      .filter(readsEnvironmentDriver)
      .map(file => file.slice(src.length + 1))
      .filter(relative => ALLOWED[relative] === undefined)
      .sort()

    expect(
      offenders,
      'resolve the driver with resolvedDatabaseDriver() from ./dialect, which prefers an application config over DB_CONNECTION (stacksjs/stacks#2897)',
    ).toEqual([])
  })

  test('every exception still has a reason to exist', () => {
    // So the list above cannot quietly outlive the reads it excuses.
    const reading = new Set(sources(src).filter(readsEnvironmentDriver).map(file => file.slice(src.length + 1)))
    const stale = Object.keys(ALLOWED).filter(relative => !reading.has(relative)).sort()

    expect(stale, 'these no longer read DB_CONNECTION, so drop them from ALLOWED').toEqual([])
  })

  test('every DDL pass follows the configured driver, not the environment', async () => {
    // Spawned with the disagreement an application creates by configuring a
    // driver its .env does not name. Before the fix the first guarantee failed
    // with `near "AT": syntax error`, postgres DDL at a sqlite file.
    const child = Bun.spawn([process.execPath, join(import.meta.dir, 'fixtures/configured-dialect-guarantees.ts')], {
      cwd: join(import.meta.dir, '..'),
      env: { ...process.env, APP_ENV: 'production', DB_CONNECTION: 'postgres', DB_QUERY_LOGGING_ENABLED: 'false' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])

    expect(exitCode, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('configured-dialect-guarantees-ok')
  })
})
