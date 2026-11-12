/**
 * Stream writes to a filesystem disk finish on the oldest Bun we support.
 *
 * CI runs one Bun, the pinned one. The Bun adapter wrote streams with
 * `Bun.write(path, new Response(stream))`, which works there and never
 * resolves on Bun 1.3, for any stream of any size: an upload to a Bun disk
 * hung the request that made it, with every test green. The same construct
 * in `buddy db:backup` hung every deploy of an app with a server database.
 *
 * So the atomic-write suite, which writes streams through both filesystem
 * adapters, is run here under the 1.3 line itself. `bun x bun@<version>`
 * fetches that Bun from npm.
 */
import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import process from 'node:process'

/** The floor in AGENTS.md ("Bun >= 1.3.0"), and the 1.3 release the hang was found on. */
const OLDEST_SUPPORTED = ['1.3.0', '1.3.14']

const SUITE = join(import.meta.dir, 'atomic-writes.test.ts')

async function run(argv: string[]): Promise<{ code: number | null, timedOut: boolean, output: string }> {
  const proc = Bun.spawn(argv, { cwd: join(import.meta.dir, '..'), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  let timedOut = false
  // The failure being guarded against is a hang, so the test owns the clock.
  const deadline = setTimeout(() => {
    timedOut = true
    proc.kill('SIGKILL')
  }, 120_000)
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { code, timedOut, output: `${stdout}\n${stderr}` }
  }
  finally {
    clearTimeout(deadline)
  }
}

describe('stream writes under the oldest supported Bun', () => {
  it.each(OLDEST_SUPPORTED)('pass the atomic-write suite on Bun %s', async (version) => {
    const probe = await run([process.execPath, 'x', `bun@${version}`, '--version'])
    if (probe.code !== 0 || !probe.output.includes(version)) {
      // Without the registry there is no old Bun to run. CI has the registry,
      // so there this is a failure; a laptop on a train gets told and moves on.
      if (process.env.CI)
        throw new Error(`could not fetch bun@${version} to test stream writes under it: ${probe.output}`)
      console.warn(`[skipped] bun@${version} could not be fetched, so stream writes were not tested under it`)
      return
    }

    const suite = await run([process.execPath, 'x', `bun@${version}`, 'test', SUITE])
    expect(suite.timedOut, `stream writes did not finish under Bun ${version}\n${suite.output}`).toBe(false)
    expect(suite.code, suite.output).toBe(0)
    expect(suite.output).toContain(' 0 fail')
  }, 180_000)
})
