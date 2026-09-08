import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'

for (const shape of ['app', 'defaults']) {
  test(`${shape} Auth middleware shares auth state across package entrypoints`, async () => {
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/auth-middleware-entrypoints.ts`, shape], { stdout: 'pipe', stderr: 'pipe' })
    const watchdog = setTimeout(() => child.kill(), 10_000)
    try {
      const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, out + error).toBe(0)
    }
    finally {
      clearTimeout(watchdog)
    }
  }, 15_000)
}

test('authorization middleware shares gates and RBAC state across entrypoints', async () => {
  const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/authorization-middleware-entrypoints.ts`], { stdout: 'pipe', stderr: 'pipe' })
  const watchdog = setTimeout(() => child.kill(), 10_000)
  try {
    const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, out + error).toBe(0)
  }
  finally {
    clearTimeout(watchdog)
  }
}, 15_000)

test('Can convention binding keeps live ORM rows and policy across warm calls', async () => {
  const runtime = join(import.meta.dir, '../../../runtime')
  await mkdir(runtime, { recursive: true })
  const directory = await mkdtemp(join(runtime, 'can-convention-'))
  const file = join(directory, 'fixture.sqlite')
  // Models may initialize during preloads. Pin the database before the child
  // starts so both the ORM and query builder use this fixture exclusively.
  const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/can-convention-entrypoints.ts`, file], {
    env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: file },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const watchdog = setTimeout(() => child.kill(), 10_000)
  try {
    const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, out + error).toBe(0)
  }
  finally {
    clearTimeout(watchdog)
    await rm(directory, { recursive: true, force: true })
  }
}, 15_000)
