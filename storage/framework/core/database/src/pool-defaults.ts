import type { PoolConfig } from './driver-config'

/**
 * How long a pooled server connection may sit idle before it is closed.
 *
 * Bun's SQL driver keeps idle connections forever unless told otherwise, and
 * an app that declares no `pool` (or one that only sets `preparedStatements`)
 * used to inherit exactly that. Every long-running process then held up to ten
 * sessions for life. A host running a web process, an API, a scheduler and
 * seven queue workers sat at 97 of Postgres' 100 slots, idle for over a day,
 * and the next deploy could not open a single connection, not even for the
 * pre-migration `pg_dump`. Thirty seconds keeps a busy process warm and gives
 * a quiet one's sessions back.
 */
export const DEFAULT_POOL_IDLE_TIMEOUT_MS = 30_000

type PoolEnv = Partial<Record<'DB_POOL_MAX' | 'DB_POOL_IDLE_TIMEOUT_MS' | 'DB_POOL_ACQUIRE_TIMEOUT_MS', unknown>>

function positive(value: unknown): number | undefined {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) && number > 0 ? number : undefined
}

function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>
}

/**
 * The pool a server connection actually gets: the framework's idle timeout,
 * then whatever the app's config declares, then the process environment.
 *
 * The environment wins so a deploy can size one process differently from the
 * rest without editing config - a queue worker running one job at a time has
 * no use for ten connections, and `DB_POOL_MAX=2` on that unit says so.
 */
export function resolvePoolConfig(configured: PoolConfig | undefined, env: PoolEnv = {}): PoolConfig {
  return {
    idleTimeoutMs: DEFAULT_POOL_IDLE_TIMEOUT_MS,
    ...defined(configured ?? {}),
    ...defined({
      max: positive(env.DB_POOL_MAX),
      idleTimeoutMs: positive(env.DB_POOL_IDLE_TIMEOUT_MS),
      acquireTimeoutMs: positive(env.DB_POOL_ACQUIRE_TIMEOUT_MS),
    }),
  }
}
