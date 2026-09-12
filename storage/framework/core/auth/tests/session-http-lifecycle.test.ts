import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('database sessions survive restart and cannot authenticate after HTTP logout', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-session-http-'))
  const file = join(directory, 'sessions.sqlite')
  const cookiesFile = join(directory, 'cookies.json')
  try {
    for (const phase of ['login', 'logout']) {
      const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/session-http-lifecycle.ts`, phase, cookiesFile], {
        env: {
          ...process.env,
          APP_ENV: 'test',
          DB_CONNECTION: 'sqlite',
          DB_DATABASE_PATH: file,
          STACKS_SESSION_FIXTURE_DB: file,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 25_000)
      try {
        const [code, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ])
        expect(code, `${phase}: ${stdout}\n${stderr}`).toBe(0)
      }
      finally {
        clearTimeout(watchdog)
        child.kill()
      }
    }
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 60_000)
