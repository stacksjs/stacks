/**
 * A compiled binary must not adopt a foreign project's maintenance state
 * (stacksjs/stacks#2888).
 *
 * `siteModeFilePath()` resolves through `projectPath()`, which walks up from
 * the CWD looking for `storage/framework`. A compiled server or desktop binary
 * has no project of its own, so launched from inside a Stacks project that is
 * in maintenance mode it read THAT project's `storage/framework/down` and
 * answered every request with its 503 holding page. From any other directory
 * the same binary served normally. Worse than the log noise #2886 made,
 * because it changes what the app does.
 *
 * Compiled for real rather than faked. `isCompiledBinary()` reads `Bun.main`,
 * which only a genuine `bun build --compile` binary reports as `/$bunfs/root`,
 * and the whole bug is about how a binary differs from a script - a mocked
 * `Bun.main` would assert the mock.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const entry = join(import.meta.dir, 'fixtures', 'maintenance-compiled-entry.ts')

describe('maintenanceGate inside a compiled binary', () => {
  let root: string
  let binary: string
  /** A project that is in maintenance mode, and is not the binary's. */
  let victim: string
  /** A directory that is no project at all, like an end user's Downloads. */
  let neutral: string

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'stacks-maint-compiled-'))
    binary = join(root, 'app')

    victim = join(root, 'victim')
    mkdirSync(join(victim, 'storage', 'framework'), { recursive: true })
    writeFileSync(join(victim, 'package.json'), '{"name":"victim"}\n')
    writeFileSync(
      join(victim, 'storage', 'framework', 'down'),
      JSON.stringify({ time: 1, retry: 60, message: 'The victim project is down' }),
    )

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

  function run(cwd: string): { reads: string, fileExists: boolean, status: number | null } {
    // APP_ENV=production so `isAllowedIp` stops trusting localhost. Without it
    // the gate waves the request through before the file ever matters, which
    // is how this first looked like it did not reproduce.
    const proc = Bun.spawnSync([binary], {
      cwd,
      env: { ...process.env, APP_ENV: 'production', APP_MAINTENANCE: 'false', APP_COMING_SOON: 'false' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const out = proc.stdout.toString()
    const line = out.trim().split('\n').find(candidate => candidate.startsWith('{"reads"'))
    if (!line)
      throw new Error(`the binary printed nothing usable (exit ${proc.exitCode})\n${out}\n${proc.stderr.toString()}`)

    return JSON.parse(line)
  }

  it('serves normally from a directory that is no project', () => {
    expect(run(neutral).status).toBeNull()
  }, 60_000)

  it('serves normally from inside a project that is in maintenance mode', () => {
    // The whole fix. Before it, this was a 503 carrying the victim's holding
    // page - from a binary that has nothing to do with that project.
    expect(run(victim).status).toBeNull()
  }, 60_000)

  it('declines even though the victim\'s file is right there to be read', () => {
    // What stops the test above from passing vacuously. The path helper still
    // resolves cwd-relative on purpose - `buddy down` writes through it on the
    // host, where the CWD IS the project - so from in here it points at the
    // victim's file and that file exists. The gate declining anyway is the fix.
    const result = run(victim)

    expect(result.reads).toContain('victim')
    expect(result.fileExists, 'the victim must really be in maintenance mode').toBe(true)
    expect(result.status).toBeNull()
  }, 60_000)

  it('still honours APP_MAINTENANCE, which is how a binary asks for the mode', () => {
    // Skipping the FILE must not cost the capability: a deployed binary sets
    // the env var, and that path is untouched.
    const proc = Bun.spawnSync([binary], {
      cwd: neutral,
      env: { ...process.env, APP_ENV: 'production', APP_MAINTENANCE: 'true', APP_COMING_SOON: 'false' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const line = proc.stdout.toString().trim().split('\n').find(c => c.startsWith('{"reads"'))!

    expect(JSON.parse(line).status).toBe(503)
  }, 60_000)
})
