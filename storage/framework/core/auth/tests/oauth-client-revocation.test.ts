import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * `revokeClient()` flipped `oauth_clients.revoked` and nothing else, and the
 * two lookups the auth middleware uses - `Auth.getUserFromToken` and
 * `Auth.validateToken` - never looked at the client or the grant. A revoked
 * third party's tokens therefore kept acting as their users until they
 * expired, and so did delegated tokens whose grant had been revoked.
 */
test('a revoked client or grant stops its tokens everywhere', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-oauth-revocation-'))
  const database = join(directory, 'auth.sqlite')
  try {
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/oauth-client-revocation.ts`], {
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: database, STACKS_OAUTH_REVOCATION_FIXTURE_DB: database },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    const line = stdout.trim().split('\n').reverse().find(candidate => candidate.startsWith('{'))
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    const results = JSON.parse(line!)

    const live = { getUserFromToken: true, validateToken: true, findToken: true }
    const dead = { getUserFromToken: false, validateToken: false, findToken: false }

    expect(results.before).toEqual(live)
    expect(results.afterRevokeClient).toEqual(dead)
    expect(results.thirdPartyRowsRevoked).toBe(true)
    // Revoking one client leaves another's tokens alone.
    expect(results.otherClient).toEqual(live)
    expect(results.revokedGrant).toEqual(dead)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 45_000)
