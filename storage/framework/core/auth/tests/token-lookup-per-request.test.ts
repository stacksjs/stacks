import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The default Auth middleware resolves the bearer with `getUserFromToken`, and
 * an action that wants the user (or an app helper that re-checks the token)
 * called it again: every authenticated request read the token row twice and
 * wrote its last-seen stamp twice. One request now resolves a bearer once.
 */
test('a request resolves its bearer once, and only for that bearer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-token-lookup-'))
  const database = join(directory, 'auth.sqlite')
  try {
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/token-lookup-per-request.ts`], {
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: database, STACKS_TOKEN_LOOKUP_FIXTURE_DB: database },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    const line = stdout.trim().split('\n').reverse().find(candidate => candidate.startsWith('{'))
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    const results = JSON.parse(line!)

    expect(results.sameRequest.first).toBe(1)
    expect(results.sameRequest.second).toBe(1)
    expect(results.sameRequest.firstQueries).toBeGreaterThan(0)
    // The second ask in the same request reads and writes nothing.
    expect(results.sameRequest.secondQueries).toBe(0)
    expect(results.sameRequest.other).toBe(2)
    expect(results.sameRequest.forged).toBeNull()
    expect(results.sameRequest.again).toBe(1)
    expect(results.nextRequest).toBeNull()
    expect(results.afterLogout).toEqual({ before: 1, after: null })
    expect(results.outsideRequest.twice).toBe(results.outsideRequest.once * 2)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 45_000)
