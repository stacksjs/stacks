import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('simple production SQLite reads use the lightweight builder with full fallback', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-fast-select-'))
  try {
    const child = Bun.spawn([process.execPath, join(import.meta.dir, 'fixtures/fast-sqlite-select.ts'), join(directory, 'fixture.sqlite')], {
      cwd: join(import.meta.dir, '..'),
      env: {
        ...process.env,
        APP_ENV: 'production',
        DB_CONNECTION: 'sqlite',
        DB_QUERY_LOGGING_ENABLED: 'false',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(exitCode, stderr).toBe(0)
    expect(stdout).toContain('fast-sqlite-select-ok')
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
