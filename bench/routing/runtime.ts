/** Shared server lifecycle and parity checks for the benchmark suites. */

import type { Scenario } from './scenarios'
import type { Target } from './targets'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { assertFixtureQueryLogged, resetFixtureLogs } from './fixture'
import { CSRF_COOKIE, CSRF_TOKEN } from './scenarios'

export const BENCH_ROOT = fileURLToPath(new URL('.', import.meta.url))
export const REPO_ROOT = join(BENCH_ROOT, '..', '..')
export const TMP = join(BENCH_ROOT, '.tmp')
export const FIXTURE = join(TMP, 'bench.sqlite')
export const PORT = Number(process.env.BENCH_PORT ?? 39400)

export interface BootedServer {
  proc: ReturnType<typeof Bun.spawn>
  pid: number
}

/** Keep benchmark targets out of the application's preload graph. */
export function serverCommand(server: string): string[] {
  return [
    process.execPath,
    `--config=${join(BENCH_ROOT, 'bunfig.toml')}`,
    join(BENCH_ROOT, 'servers', server),
  ]
}

/** Give every framework the same production environment. */
export function serverEnvironment(target: Target, withDb: boolean, scenarioId?: string): Record<string, string> {
  return {
    ...process.env,
    APP_ENV: 'production',
    NODE_ENV: 'production',
    BENCH_PORT: String(PORT),
    BENCH_DB: withDb ? '1' : '0',
    BENCH_DB_FILE: FIXTURE,
    DB_CONNECTION: 'sqlite',
    DB_DATABASE_PATH: FIXTURE,
    BENCH_SCENARIO: scenarioId ?? '',
    BENCH_MODE: 'secure',
    BENCH_SQLITE_PROFILE: 'stock',
    STACKS_SECURITY_HEADERS_DISABLE: 'false',
    ...target.env,
  } as Record<string, string>
}

/** Start a target with a deadline for HTTP readiness and clean up failed starts. */
export async function boot(target: Target, withDb: boolean, scenario?: Scenario, timeoutMs = 60_000): Promise<BootedServer | { skipped: string }> {
  const proc = Bun.spawn(serverCommand(target.server), {
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: serverEnvironment(target, withDb, scenario?.id),
  })

  // A scenario-specific server may expose only its validated POST route.
  const url = `http://127.0.0.1:${PORT}${scenario?.path ?? '/bench/json'}`
  const request: RequestInit | undefined = scenario
    ? {
        method: scenario.method,
        headers: headersFor(target, scenario),
        ...(scenario.body != null ? { body: scenario.body } : {}),
      }
    : undefined
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let ready = false
  try {
    while (!controller.signal.aborted) {
      if (proc.exitCode != null) {
        const err = await new Response(proc.stderr).text()
        // 78 is EX_CONFIG: the server said "I am not installed here".
        if (proc.exitCode === 78 || target.optional)
          return { skipped: err.trim().split('\n').pop() || `exited ${proc.exitCode}` }
        throw new Error(`${target.id} server exited ${proc.exitCode}:\n${err}`)
      }
      try {
        const res = await fetch(url, { ...request, signal: controller.signal })
        if (res.ok) {
          await res.arrayBuffer()
          if (!controller.signal.aborted) {
            ready = true
            return { proc, pid: proc.pid }
          }
        }
        else {
          await res.body?.cancel()
        }
      }
      catch { /* not listening yet, or the startup deadline expired */ }
      if (!controller.signal.aborted) await Bun.sleep(100)
    }
    throw new Error(`${target.id} server did not become ready within ${timeoutMs / 1000}s`)
  }
  finally {
    clearTimeout(timer)
    controller.abort()
    if (!ready) {
      // A failed benchmark server must not survive to occupy the port or
      // consume CPU/RSS during the next target's measurements.
      if (proc.exitCode == null) proc.kill('SIGKILL')
      await proc.exited
    }
  }
}

export async function stop(server: BootedServer): Promise<void> {
  server.proc.kill()
  await server.proc.exited
}

export function headersFor(target: Target, scenario: Scenario): Record<string, string> {
  const headers: Record<string, string> = {}
  if (scenario.body != null) headers['content-type'] = 'application/json'

  // Unsafe methods always carry the double-submit pair. The cold-client
  // profile is about what a first-time GET costs; it is not a claim that a
  // client can mutate state without a token, and pretending otherwise would
  // measure a 403 instead of a route.
  const unsafe = scenario.method !== 'GET'
  if (target.cookie || unsafe) headers.cookie = CSRF_COOKIE
  if (unsafe) headers['x-csrf-token'] = CSRF_TOKEN

  return headers
}

/** Require byte-identical successful responses before measuring a target. */
export async function assertParity(target: Target, scenario: Scenario): Promise<void> {
  const requiresQueryLog = target.server === 'stacks.ts' && scenario.requiresDb
  if (requiresQueryLog)
    resetFixtureLogs(FIXTURE)

  const res = await fetch(`http://127.0.0.1:${PORT}${scenario.path}`, {
    method: scenario.method,
    headers: headersFor(target, scenario),
    ...(scenario.body != null ? { body: scenario.body } : {}),
  })
  const body = (await res.text()).trim()
  if (!res.ok)
    throw new Error(`${target.id} answered ${res.status} for ${scenario.id}: ${body.slice(0, 200)}`)
  if (body !== scenario.expect)
    throw new Error(`${target.id} answered ${body.slice(0, 200)} for ${scenario.id}, expected ${scenario.expect}`)
  if (requiresQueryLog)
    await assertFixtureQueryLogged(FIXTURE)
}
