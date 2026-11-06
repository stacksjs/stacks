import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('API capture persists actual response statuses with native and fetch dispatch', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-http-capture-'))
  const file = join(directory, 'requests.sqlite')
  const child = Bun.spawn([process.execPath, '--no-env-file', `--config=${import.meta.dir}/fixtures/cold-start.toml`, `${import.meta.dir}/fixtures/request-capture.ts`], {
    env: { ...process.env, APP_ENV: 'test', NODE_ENV: 'test', STACKS_DASHBOARD_WORKER: '0', HTTP_CAPTURE_TEST_FILE: file, DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: file },
    stdout: 'pipe', stderr: 'pipe',
  })
  const timeout = setTimeout(() => child.kill(), 20000)
  try {
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('HTTP_CAPTURE_STORAGE_OK')
  }
  finally { clearTimeout(timeout); child.kill(); rmSync(directory, { recursive: true, force: true }) }
}, 25000)
