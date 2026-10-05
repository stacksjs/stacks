/**
 * Which environment variables hold numbers.
 *
 * The proxy used to decide by name suffix alone (`_PORT`, `_TTL`, ...), so 21
 * of the 26 framework variables typed `number` in `types.ts` came back as
 * strings: every `PORT_*`, the database pool's `*_MS`, and the auth lifetimes.
 * `AUTH_TOKEN_EXPIRY=7200000` in `.env` made `Date.now() + tokenExpiry` a
 * string concatenation, and every token issued after it carried an
 * `Invalid Date`. The type said number; nothing made it one.
 *
 * Kept in step with `types.ts` by `numeric-keys.test.ts`.
 */
export const FRAMEWORK_NUMERIC_ENV_KEYS: ReadonlySet<string> = new Set([
  'PORT',
  'PORT_BACKEND',
  'PORT_ADMIN',
  'PORT_LIBRARY',
  'PORT_DESKTOP',
  'PORT_EMAIL',
  'PORT_DOCS',
  'PORT_INSPECT',
  'PORT_API',
  'PORT_SYSTEM_TRAY',
  'DB_PORT',
  'DB_POOL_MAX',
  'DB_POOL_IDLE_TIMEOUT_MS',
  'DB_POOL_ACQUIRE_TIMEOUT_MS',
  'DB_QUERY_LOGGING_SLOW_THRESHOLD',
  'DB_QUERY_LOGGING_RETENTION_DAYS',
  'DB_QUERY_LOGGING_PRUNE_FREQUENCY',
  'MAIL_PORT',
  'STRIPE_CONNECT_FEE_PERCENT',
  'BROADCAST_PORT',
  'REDIS_PORT',
  'AUTH_TOKEN_EXPIRY',
  'AUTH_REFRESH_TOKEN_EXPIRY',
  'AUTH_TOKEN_ROTATION',
  'AUTH_PASSWORD_RESET_EXPIRE',
  'AUTH_PASSWORD_RESET_THROTTLE',
])

/** Name suffixes that have always meant a number, for variables nothing declared. */
export const NUMERIC_ENV_SUFFIXES: readonly string[] = ['_PORT', '_TIMEOUT', '_TTL', '_SIZE', '_LIMIT', '_MAX', '_MIN', '_INTERVAL', '_RETRIES', '_CONCURRENCY', '_WORKERS', '_CONNECTIONS']

const declaredNumericKeys = new Set<string>()

/**
 * Record the variables an app's `config/env.ts` validates as numbers, so the
 * proxy hands them over as numbers too. Called by `defineEnv()`.
 */
export function registerNumericEnvKeys(schema: Record<string, unknown>): void {
  for (const [key, entry] of Object.entries(schema)) {
    const validation = (entry as { validation?: { name?: unknown } } | undefined)?.validation
    if (validation?.name === 'number')
      declaredNumericKeys.add(key)
  }
}

/** Whether a variable was declared as a number, by the framework or the app. */
export function isDeclaredNumericEnvKey(key: string): boolean {
  return FRAMEWORK_NUMERIC_ENV_KEYS.has(key) || declaredNumericKeys.has(key)
}
