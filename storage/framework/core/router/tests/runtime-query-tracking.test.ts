import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function expectQueryTracking(entrypoint: string): Promise<void> {
  const child = Bun.spawn([
    process.execPath,
    `--config=${import.meta.dir}/fixtures/cold-start.toml`,
    entrypoint,
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
    expect(`${stdout}\n${stderr}`).toContain('Possible N+1')
  }
  finally {
    clearTimeout(timeout)
    child.kill()
    await child.exited
  }
}

describe('runtime query tracking', () => {
  test('records queries and N+1 diagnostics before the first error renderer load', async () => {
    await expectQueryTracking(`${import.meta.dir}/fixtures/runtime-query-tracking.ts`)
  }, 15_000)

  test('preserves query tracking in a bundled runtime entry', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'router-query-tracking-'))
    try {
      const result = await Bun.build({
        entrypoints: [`${import.meta.dir}/fixtures/runtime-query-tracking.ts`],
        target: 'bun',
        write: false,
      })
      expect(result.success).toBe(true)
      expect(result.outputs).toHaveLength(1)
      const bundle = join(directory, 'runtime-query-tracking.js')
      await Bun.write(bundle, result.outputs[0])
      await expectQueryTracking(bundle)
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  }, 15_000)
})
