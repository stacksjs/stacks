export interface ApplicationHealthCheck {
  ok: boolean
  message?: string
  ms: number
}

export interface ApplicationHealthResult {
  status: 'healthy' | 'degraded'
  checks: Record<string, ApplicationHealthCheck>
  timestamp: number
}

export interface HealthProbe {
  name: string
  run: () => Promise<unknown>
}

export interface HealthProbeOptions {
  timeoutMs?: number
  now?: () => number
}

export async function runHealthProbes(
  probes: HealthProbe[],
  options: HealthProbeOptions = {},
): Promise<ApplicationHealthResult> {
  const timeoutMs = options.timeoutMs ?? 1500
  const now = options.now ?? Date.now

  const entries = await Promise.all(probes.map(async ({ name, run }): Promise<[string, ApplicationHealthCheck]> => {
    const startedAt = now()
    let timeout: ReturnType<typeof setTimeout> | undefined

    try {
      await Promise.race([
        run(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('timeout')), timeoutMs)
        }),
      ])
      return [name, { ok: true, ms: Math.max(0, now() - startedAt) }]
    }
    catch (error) {
      return [name, {
        ok: false,
        ms: Math.max(0, now() - startedAt),
        message: error instanceof Error ? error.message : String(error),
      }]
    }
    finally {
      if (timeout)
        clearTimeout(timeout)
    }
  }))
  const checks = Object.fromEntries(entries)

  return {
    status: Object.values(checks).every(check => check.ok) ? 'healthy' : 'degraded',
    checks,
    timestamp: now(),
  }
}

/**
 * What the database check reports once core/database has recorded a pool
 * broken by oven-sh/bun#42804. It names the bug and the remedy but not the
 * pool: this endpoint is public and unauthenticated, so the pool's host, port
 * and database are only in the server log line core/database writes.
 */
const BROKEN_POOL_HEALTH_MESSAGE = 'Database pool broken by oven-sh/bun#42804 until the process restarts. The server log names the pool.'

/**
 * Fail the database check once core/database has recorded a broken pool.
 *
 * Nothing restarts the process on this 503 today. ts-cloud 0.16.0's liveness
 * timer requests `/` with curl and no `-f`, so any HTTP response, a 503
 * included, counts as alive, and config/cloud.ts gives its sites no health
 * check path. Someone, or something pointed at /api/health, has to restart it.
 */
function throwIfDatabasePoolBroken(database: typeof import('@stacksjs/database/runtime')): void {
  if (database.getBrokenDatabasePools().length > 0)
    throw new Error(BROKEN_POOL_HEALTH_MESSAGE)
}

export async function checkApplicationHealth(
  options: HealthProbeOptions = {},
): Promise<ApplicationHealthResult> {
  return runHealthProbes([
    {
      name: 'database',
      async run() {
        const database = await import('@stacksjs/database/runtime')
        // A pool broken by oven-sh/bun#42804 stays recorded until the process
        // restarts, so once one is, this check fails with that cause even when
        // the probe below would succeed on another connection.
        throwIfDatabasePoolBroken(database)
        const { db } = database
        const unsafe = (db as { unsafe?: (sql: string) => Promise<unknown> }).unsafe
        if (typeof unsafe !== 'function')
          throw new Error('database driver does not expose a raw health probe')
        try {
          await unsafe.call(db, 'SELECT 1')
        }
        catch (error) {
          // `db.unsafe()` fires no query hook, so this probe reports what it
          // saw itself. Anything but Bun's broken-pool error is ignored there.
          database.recordPrimaryDatabaseQueryError(error)
          throwIfDatabasePoolBroken(database)
          throw error
        }
      },
    },
    {
      name: 'cache',
      async run() {
        const { cache } = await import('@stacksjs/cache')
        const key = `__health__:${Date.now()}`
        let stored = false
        try {
          await cache.set(key, 1, 5)
          stored = true
        }
        finally {
          if (stored)
            await cache.del(key)
        }
      },
    },
  ], options)
}
