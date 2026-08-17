import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'

describe('database connection reset', () => {
  it('rebuilds the Stacks db proxy after discarding the lower connection', async () => {
    const fixture = join(import.meta.dir, 'fixtures', 'connection-reset.ts')
    const child = Bun.spawn([process.execPath, fixture], {
      cwd: join(import.meta.dir, '..', '..', '..', '..', '..'),
      env: { ...process.env },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])

    expect(exitCode, stderr).toBe(0)
    expect(stdout).toContain('connection-reset-ok')
  })
})
