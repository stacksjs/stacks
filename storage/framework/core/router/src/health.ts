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

export async function checkApplicationHealth(
  options: HealthProbeOptions = {},
): Promise<ApplicationHealthResult> {
  return runHealthProbes([
    {
      name: 'database',
      async run() {
        const { db } = await import('@stacksjs/database')
        const unsafe = (db as { unsafe?: (sql: string) => Promise<unknown> }).unsafe
        if (typeof unsafe !== 'function')
          throw new Error('database driver does not expose a raw health probe')
        await unsafe.call(db, 'SELECT 1')
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
