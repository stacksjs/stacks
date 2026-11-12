/**
 * A dump completes, and stays small in memory, on the oldest Bun we support.
 *
 * CI runs one Bun, the pinned one. The dump writer was first written against
 * it as `Bun.write(partial, new Response(proc.stdout.pipeThrough(new
 * CompressionStream('gzip'))))`, which works there and never resolves on Bun
 * 1.3, at any size. The box that deploys run on had 1.3.14, so every deploy of
 * an app with a server database hung at its pre-migration backup until CI
 * cancelled it six hours later, with every test here green.
 *
 * So this file runs the same writer and reader under the 1.3 line itself: the
 * declared floor and the release that hung. `bun x bun@<version>` fetches that
 * Bun from npm; the fixture takes a dump and puts it back through both ways of
 * moving the bytes at two sizes, and reports its peak memory. The dump and restore suite is
 * then run under the release that hung.
 */
import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import process from 'node:process'

/** The floor in AGENTS.md ("Bun >= 1.3.0"), and the 1.3 release the hang was found on. */
const OLDEST_SUPPORTED = ['1.3.0', '1.3.14']

const FIXTURE = join(import.meta.dir, 'fixtures', 'database-backup-under-bun.ts')
const SUITE = join(import.meta.dir, 'database-backup.test.ts')

/** Megabytes of dump, small then large. Flat means the second costs no more memory than the first. */
const SMALL_MB = 256
const LARGE_MB = 1024

/**
 * How much more resident memory the large dump may take than the small one,
 * in megabytes. The baseline differs by platform and Bun (35 to 115 MB on
 * macOS, more on Linux), so it is the growth that is held, not the level. A
 * writer with no backpressure holds two to three times the dump, which here
 * is growth of 1.5 GB and more.
 */
const GROWTH_MB = 192

interface Outcome {
  bun: string
  via: string
  dumpMB: number
  peakRssMB: number
  roundTrip: boolean
}

async function run(argv: string[]): Promise<{ code: number | null, timedOut: boolean, stdout: string, stderr: string }> {
  const proc = Bun.spawn(argv, { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  let timedOut = false
  // The failure being guarded against is a hang, so the test owns the clock.
  const deadline = setTimeout(() => {
    timedOut = true
    proc.kill('SIGKILL')
  }, 150_000)
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { code, timedOut, stdout, stderr }
  }
  finally {
    clearTimeout(deadline)
  }
}

function outcomes(stdout: string): Outcome[] {
  return stdout.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line) as Outcome)
}

async function roundTrip(bun: string[], megabytes: number, version: string): Promise<Outcome[]> {
  const result = await run([...bun, FIXTURE, String(megabytes)])
  expect(result.timedOut, `the dump did not finish under Bun ${version}\n${result.stderr}`).toBe(false)
  expect(result.code, result.stderr).toBe(0)

  const reported = outcomes(result.stdout)
  expect(reported.map(o => o.via)).toEqual(['pipe', 'process'])
  for (const outcome of reported) {
    expect(outcome.bun).toBe(version)
    expect(outcome.dumpMB).toBe(megabytes)
    expect(outcome.roundTrip).toBe(true)
  }
  return reported
}

async function expectFlat(bun: string[], version: string): Promise<void> {
  const small = await roundTrip(bun, SMALL_MB, version)
  const large = await roundTrip(bun, LARGE_MB, version)

  // Printed either way: these are the only numbers anyone has for a platform
  // they are not sitting at.
  console.log(JSON.stringify({ platform: process.platform, small, large }))

  for (const [index, outcome] of large.entries())
    expect(outcome.peakRssMB - small[index]!.peakRssMB, `${outcome.via} on Bun ${version}`).toBeLessThan(GROWTH_MB)
}

describe.skipIf(process.platform === 'win32')('a dump under the oldest supported Bun', () => {
  it.each(OLDEST_SUPPORTED)('completes, round-trips and stays flat in memory on Bun %s', async (version) => {
    const probe = await run([process.execPath, 'x', `bun@${version}`, '--version'])
    if (probe.code !== 0 || probe.stdout.trim() !== version) {
      // Without the registry there is no old Bun to run. CI has the registry,
      // so there this is a failure; a laptop on a train gets told and moves on.
      if (process.env.CI)
        throw new Error(`could not fetch bun@${version} to test the dump under it: ${probe.stderr || probe.stdout}`)
      console.warn(`[skipped] bun@${version} could not be fetched, so the dump was not tested under it`)
      return
    }

    await expectFlat([process.execPath, 'x', `bun@${version}`], version)
  }, 240_000)

  // The whole contract, not only the round trip: a failed tool, a failed gzip,
  // the deadline and a truncated dump all behave differently across Bun
  // versions (a write to a tool that had exited rejected outside its try on
  // 1.3 only, which this is what found).
  //
  // Only on the release that hung. On Linux, Bun 1.3.0 cannot load a test file
  // when its runner is started from inside another Bun's test run ("Export
  // named 'afterEach' not found in module 'bun:test'"), so there the round
  // trip above is what holds the floor.
  it.each(['1.3.14'])('passes the dump and restore suite on Bun %s', async (version) => {
    const probe = await run([process.execPath, 'x', `bun@${version}`, '--version'])
    if (probe.code !== 0 && !process.env.CI)
      return

    const suite = await run([process.execPath, 'x', `bun@${version}`, 'test', SUITE])
    expect(suite.timedOut, suite.stderr).toBe(false)
    expect(suite.code, suite.stderr).toBe(0)
    expect(suite.stderr).toContain(' 0 fail')
  }, 240_000)

  it('does the same under the Bun running these tests', async () => {
    await expectFlat([process.execPath], Bun.version)
  }, 240_000)
})
