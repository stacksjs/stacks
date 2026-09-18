/**
 * Regression coverage for stacksjs/stacks#1955.
 *
 * `defaults/routes/dashboard.ts` used to register `GET /install` (returns
 * the framework's shell bootstrap script — free stack fingerprinting) and
 * `GET /test-error` (an on-demand exception generator: `?type=` picks a
 * 401/404/422/500 scenario) unconditionally, with no middleware and no
 * environment gate — unlike every sensitive sibling group in the same file
 * and unlike the IS_LOCAL_ENV gate in `defaults/routes/dashboard-api.ts`.
 * Since `dashboard` is the only feature that defaults to ON, every app that
 * didn't opt out shipped both endpoints to production.
 *
 * Now both registrations sit behind the same `isLocalDeployment()` gate as
 * dashboard-api.ts, and TestErrorAction additionally short-circuits to 404 in
 * production so even a userland re-registration can't expose the exception
 * generator there.
 *
 * That gate used to be an environment-name allowlist that counted
 * `development` as local. `.env.example` ships `APP_ENV=development`, so the
 * name alone re-opened this issue for every app that never edited the line;
 * the decision now comes from `APP_URL`'s host, as the auth cookie's has
 * since stacksjs/stacks#2275. See core/env/tests/local-deployment.test.ts.
 *
 * The registration gate is evaluated at module-import time and bun caches
 * modules per process (and `bun test` shares one process across files —
 * route-loader.test.ts already imports the full defaults bootstrap into the
 * singleton route table), so each APP_ENV scenario runs the
 * fixtures/print-dashboard-routes.ts fixture in a fresh subprocess.
 */

import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import process from 'node:process'

const projectRoot = join(import.meta.dir, '../../../../..')
const fixture = join(import.meta.dir, 'fixtures/print-dashboard-routes.ts')

/**
 * Every scenario states all three inputs, including the ones it wants empty.
 *
 * Deleting them is not enough. The bunfig env preload fills whatever is
 * absent from the checkout's own `.env`, which ships `APP_ENV=development`
 * and `APP_URL=stacks.localhost`, so a deleted `APP_URL` came back a loopback
 * host and the gate read this machine rather than the scenario. CI has no
 * `.env` and so disagreed: this suite passed here while `APP_ENV=development`
 * failed there. A value that is present but empty is passed through untouched
 * - the preload only fills what is missing - and empty is what
 * `isLocalDeployment()` sees for a variable nobody set.
 */
async function routesFor(appEnv: string = '', appUrl: string = ''): Promise<string[]> {
  const env: Record<string, string | undefined> = { ...process.env, APP_ENV: appEnv, NODE_ENV: '', APP_URL: appUrl }

  const proc = Bun.spawn(['bun', fixture], {
    cwd: projectRoot,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ])
  expect(exitCode).toBe(0)

  // The preloader may chat on stdout before the fixture prints — the
  // route snapshot is always the last non-empty line.
  const lines = stdout.trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as string[]
}

describe('dev-only default routes - registration gate (#1955)', () => {
  test('a public URL omits them even when the environment calls itself development', async () => {
    // `.env.example` ships `APP_ENV=development`, so the environment name on
    // its own put both endpoints into production for every app that never
    // edited that line. The URL is what decides now.
    const routes = await routesFor('development', 'https://app.example.com')

    expect(routes).not.toContain('GET /install')
    expect(routes).not.toContain('GET /test-error')
  })

  test('a loopback URL keeps them for local development', async () => {
    const routes = await routesFor('development', 'stacks.localhost')

    expect(routes).toContain('GET /install')
    expect(routes).toContain('GET /test-error')
  })

  test('APP_ENV=production omits /install and /test-error', async () => {
    const routes = await routesFor('production')
    expect(routes).not.toContain('GET /install')
    expect(routes).not.toContain('GET /test-error')
    // Sanity: the file still registered — the gate fired, not a broken import.
    // Anchored on a route dashboard.ts still owns. This used to be
    // `POST /login`, which moved to defaults/routes/auth.ts when the auth
    // bundle was split out (stacksjs/stacks#2229) and the fixture only imports
    // dashboard.ts.
    expect(routes).toContain('POST /ai/ask')
  }, 30000)

  test('APP_ENV=staging omits both (allowlist, not a production blocklist)', async () => {
    const routes = await routesFor('staging')
    expect(routes).not.toContain('GET /install')
    expect(routes).not.toContain('GET /test-error')
    expect(routes).toContain('POST /ai/ask')
  }, 30000)

  test('unset APP_ENV/NODE_ENV keeps both (buddy dev out of the box)', async () => {
    const routes = await routesFor()
    expect(routes).toContain('GET /install')
    expect(routes).toContain('GET /test-error')
  }, 30000)

  test('APP_ENV=development alone no longer keeps them', async () => {
    // This assertion used to be the reverse, and that was the hole itself:
    // `development` is the name every app that never edited `.env.example`
    // reports, so accepting it as proof of localness is what shipped both
    // endpoints to production. With no URL to check there is no evidence of
    // localness left, so the gate closes rather than guessing.
    const routes = await routesFor('development')

    expect(routes).not.toContain('GET /install')
    expect(routes).not.toContain('GET /test-error')
    // The file still registered - the gate fired, not a broken import.
    expect(routes).toContain('POST /ai/ask')
  }, 30000)

  test('APP_ENV=test keeps both (e2e suites exercising the error tester)', async () => {
    const routes = await routesFor('test')
    expect(routes).toContain('GET /install')
    expect(routes).toContain('GET /test-error')
  }, 30000)
})

describe('TestErrorAction - production handler guard (#1955)', () => {
  let prevAppEnv: string | undefined
  let prevNodeEnv: string | undefined

  function setEnv(value: string): void {
    prevAppEnv = process.env.APP_ENV
    prevNodeEnv = process.env.NODE_ENV
    process.env.APP_ENV = value
    process.env.NODE_ENV = value
  }

  function restoreEnv(): void {
    if (prevAppEnv === undefined) delete process.env.APP_ENV
    else process.env.APP_ENV = prevAppEnv
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
  }

  test('production short-circuits to 404 even when re-registered', async () => {
    setEnv('production')
    try {
      const { default: action } = await import('../../../defaults/app/Actions/TestErrorAction')
      const res = await action.handle(new Request('http://localhost/test-error?type=validation') as any)
      expect(res.status).toBe(404)
    }
    finally {
      restoreEnv()
    }
  })

  test('development still throws the requested scenario', async () => {
    setEnv('development')
    try {
      const { default: action } = await import('../../../defaults/app/Actions/TestErrorAction')
      await expect(
        action.handle(new Request('http://localhost/test-error?type=validation') as any),
      ).rejects.toThrow('valid email')
    }
    finally {
      restoreEnv()
    }
  })
})

describe('InstallAction - production handler guard (#1955)', () => {
  let prevAppEnv: string | undefined
  let prevNodeEnv: string | undefined

  function setEnv(value: string): void {
    prevAppEnv = process.env.APP_ENV
    prevNodeEnv = process.env.NODE_ENV
    process.env.APP_ENV = value
    process.env.NODE_ENV = value
  }

  function restoreEnv(): void {
    if (prevAppEnv === undefined) delete process.env.APP_ENV
    else process.env.APP_ENV = prevAppEnv
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
  }

  test('production short-circuits to 404 even when re-registered', async () => {
    setEnv('production')
    try {
      const { default: action } = await import('../../../defaults/app/Actions/InstallAction')
      const res = await action.handle(new Request('http://localhost/install') as any)
      expect(res).toBeInstanceOf(Response)
      expect((res as Response).status).toBe(404)
    }
    finally {
      restoreEnv()
    }
  })

  test('development still serves the bootstrap script', async () => {
    setEnv('development')
    try {
      const { default: action } = await import('../../../defaults/app/Actions/InstallAction')
      const res = await action.handle(new Request('http://localhost/install') as any)
      expect(typeof res).toBe('string')
      expect(res as string).toContain('git clone https://github.com/stacksjs/stacks.git')
    }
    finally {
      restoreEnv()
    }
  })
})

describe('buddy build server image - fails closed (#1955)', () => {
  // The registration gate treats an unset APP_ENV/NODE_ENV as local, and the
  // `buddy build server` image (storage/framework/server/Dockerfile) ships no
  // .env for Bun's cwd auto-load to find — so unless the image itself pins
  // APP_ENV=production, that container registers /install and /test-error.
  // ENV must live in the final (release) stage: multi-stage builds don't
  // carry builder-stage ENV into the released image.
  test('server Dockerfile pins APP_ENV/NODE_ENV=production in the release stage', async () => {
    const dockerfile = await Bun.file(
      join(projectRoot, 'storage/framework/server/Dockerfile'),
    ).text()
    const releaseStage = dockerfile.slice(dockerfile.lastIndexOf('\nFROM '))
    const directives = releaseStage
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '' && !line.startsWith('#'))
    expect(directives).toContain('ENV APP_ENV=production')
    expect(directives).toContain('ENV NODE_ENV=production')
  })
})
