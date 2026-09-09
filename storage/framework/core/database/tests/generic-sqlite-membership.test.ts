import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('generic SQLite membership preserves upstream results, errors and live reads', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-membership-'))
  try {
    const child = Bun.spawn([process.execPath, join(import.meta.dir, 'fixtures/generic-sqlite-membership.ts'), join(directory, 'fixture.sqlite')], {
      cwd: join(import.meta.dir, '..'),
      env: { ...process.env, APP_ENV: 'production', DB_CONNECTION: 'sqlite', DB_QUERY_LOGGING_ENABLED: 'false' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(exitCode, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('generic-sqlite-membership-ok')
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
