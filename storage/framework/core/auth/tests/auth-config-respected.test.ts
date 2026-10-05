import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Three places auth did not do what it was configured or asked to:
 *
 * - The code that enabled 2FA was not recorded as used, so the same six
 *   digits were accepted once more at login within their window.
 * - `refreshToken()` (and the refresh action) fixed the new pair at one hour
 *   and 30 days, whatever `tokenExpiry` / `refreshTokenExpiry` said.
 * - Policy discovery stripped the first `Policy` from a file name, so
 *   `PolicyHolderPolicy` registered for `HolderPolicy`, and every check on the
 *   real `PolicyHolder` model was denied.
 */
test('auth respects its configuration', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-auth-config-'))
  const database = join(directory, 'auth.sqlite')
  try {
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/auth-config-respected.ts`], {
      env: {
        ...process.env,
        APP_ENV: 'test',
        DB_CONNECTION: 'sqlite',
        DB_DATABASE_PATH: database,
        STACKS_AUTH_CONFIG_FIXTURE_DB: database,
        STACKS_AUTH_CONFIG_FIXTURE_PROJECT: join(directory, 'project'),
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    const out = JSON.parse(stdout.trim().split('\n').reverse().find(line => line.startsWith('{'))!)

    expect(out.enabled).toBe(true)
    expect(out.replayAccepted).toBe(false)

    expect(out.refreshedExpiresIn).toBe(2 * 60 * 60)
    expect(out.refreshDaysLeft).toBe(7)

    expect(out.policyForPolicyHolder).toBe(true)
    expect(out.policyForHolderPolicy).toBe(false)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 45_000)
