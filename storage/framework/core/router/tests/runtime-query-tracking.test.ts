import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const fixture = `${import.meta.dir}/fixtures/runtime-query-tracking.ts`

async function runQueryTracking(entrypoint: string, mode: 'cli' | 'request'): Promise<string> {
  const child = Bun.spawn([
    process.execPath,
    `--config=${import.meta.dir}/fixtures/cold-start.toml`,
    entrypoint,
    mode,
  ], { stdout: 'pipe', stderr: 'pipe' })
  const timeout = setTimeout(() => child.kill(), 10_000)
  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(exitCode, stderr).toBe(0)
    expect(stdout).toContain('runtime-query-tracking-ok')
    return `${stdout}\n${stderr}`
  }
  finally {
    clearTimeout(timeout)
    child.kill()
    await child.exited
  }
}

describe('runtime query tracking', () => {
  test('warns about a possible N+1 inside a request', async () => {
    const output = await runQueryTracking(fixture, 'request')
    expect(output).toContain('Possible N+1 - query shape ran 6× in this request')
  }, 15_000)

  // A CLI command or queue worker has no request, so a shape count there never
  // resets and would warn about unrelated work adding up across the process.
  test('records queries but does not warn about N+1 in a bare CLI loop', async () => {
    const output = await runQueryTracking(fixture, 'cli')
    expect(output).not.toContain('Possible N+1')
  }, 15_000)

  test('preserves query tracking in a bundled runtime entry', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'router-query-tracking-'))
    try {
      const result = await Bun.build({
        entrypoints: [fixture],
        target: 'bun',
        write: false,
      })
      expect(result.success).toBe(true)
      expect(result.outputs).toHaveLength(1)
      const bundle = join(directory, 'runtime-query-tracking.js')
      await Bun.write(bundle, result.outputs[0])
      expect(await runQueryTracking(bundle, 'request')).toContain('Possible N+1')
      expect(await runQueryTracking(bundle, 'cli')).not.toContain('Possible N+1')
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  }, 15_000)
})
