/** Shared server lifecycle and parity checks for the benchmark suites. */

import type { Scenario } from './scenarios'
import type { Target } from './targets'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
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

export async function boot(target: Target, withDb: boolean): Promise<BootedServer | { skipped: string }> {
  const proc = Bun.spawn(['bun', join(BENCH_ROOT, 'servers', target.server)], {
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      BENCH_PORT: String(PORT),
      BENCH_DB: withDb ? '1' : '0',
      BENCH_DB_FILE: FIXTURE,
      DB_DATABASE_PATH: FIXTURE,
      ...target.env,
    } as Record<string, string>,
  })

  const deadline = Date.now() + 60_000
  for (;;) {
    if (proc.exitCode != null) {
      const err = await new Response(proc.stderr).text()
      // 78 is EX_CONFIG: the server said "I am not installed here".
      if (proc.exitCode === 78 || target.optional)
        return { skipped: err.trim().split('\n').pop() || `exited ${proc.exitCode}` }
      throw new Error(`${target.id} server exited ${proc.exitCode}:\n${err}`)
    }
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/bench/json`)
      if (res.ok) {
        await res.arrayBuffer()
        break
      }
    }
    catch { /* not listening yet */ }
    if (Date.now() > deadline)
      throw new Error(`${target.id} server did not become ready within 60s`)
    await Bun.sleep(100)
  }

  return { proc, pid: proc.pid }
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
}
