/**
 * A compiled binary cannot load route files from disk, and now says why
 * (stacksjs/stacks#2888).
 *
 * This started as a suspected leak: `importRouteFile` resolves
 * `routes/<name>` through `projectPath()`, which walks up from the CWD, so a
 * binary looked able to load a FOREIGN project's routes. Measured against this
 * repository, it cannot load any:
 *
 *   script,  from the project root  ->  1178 routes, no error
 *   binary,  from the project root  ->  0 routes, throws
 *   binary,  from a neutral dir     ->  0 routes, throws
 *   binary,  static import          ->  routes present (bundled)
 *
 * A route file read off disk resolves its own `import { route } from
 * '@stacksjs/router'` from disk, and that fails from inside a bundle. So there
 * is nothing to guard - the import cannot succeed, against its own project or
 * anybody else's - and routes reach a binary by being imported statically.
 *
 * What was worth fixing is the message. It used to surface as
 * `Cannot find package '@stacksjs/router' imported from <project>/routes/api.ts`,
 * which reads as a broken install and sent me looking at node_modules.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const entry = join(import.meta.dir, 'fixtures', 'compiled-route-load-entry.ts')

describe('loadRoutes inside a compiled binary', () => {
  let root: string
  let binary: string
  let neutral: string

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'stacks-compiled-routes-'))
    binary = join(root, 'app')
    neutral = join(root, 'neutral')
    mkdirSync(neutral, { recursive: true })

    const built = Bun.spawnSync(['bun', 'build', '--compile', '--outfile', binary, entry], {
      cwd: join(import.meta.dir, '..'),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(built.exitCode, built.stderr.toString()).toBe(0)
  }, 180_000)

  afterAll(() => rmSync(root, { recursive: true, force: true }))

  function run(cwd: string): { routeCount: number, error: string | null } {
    const proc = Bun.spawnSync([binary], { cwd, env: { ...process.env, APP_ENV: 'test' }, stdout: 'pipe', stderr: 'pipe' })
    const line = proc.stdout.toString().trim().split('\n').find(c => c.startsWith('{"routeCount"'))
    if (!line)
      throw new Error(`the binary printed nothing usable (exit ${proc.exitCode})\n${proc.stdout.toString()}\n${proc.stderr.toString()}`)
    return JSON.parse(line)
  }

  it('explains itself instead of reporting a missing package', () => {
    const result = run(neutral)

    expect(result.routeCount).toBe(0)
    expect(result.error).toContain('from a compiled binary')
    // The two ways out, both in the message.
    expect(result.error).toContain('Import the route file statically')
    expect(result.error).toContain('run the app with `bun`')
    // What it must NOT look like any more.
    expect(result.error).not.toContain('Cannot find package')
  }, 60_000)

  it('says the same thing inside a real project, since the CWD is not the cause', () => {
    // The suspected leak. Run from a directory that IS a Stacks project, the
    // loader still refuses rather than loading that project's routes.
    const result = run(join(import.meta.dir, '..', '..', '..', '..', '..'))

    expect(result.routeCount).toBe(0)
    expect(result.error).toContain('from a compiled binary')
  }, 60_000)

  it('names the route file it was asked for', () => {
    expect(run(neutral).error).toContain('routes/api')
  }, 60_000)
})
