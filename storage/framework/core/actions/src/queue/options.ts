import { parseArgv } from '@stacksjs/cli'

/** Match Buddy's argv without coercing queue names, identities or filters. */
export function queueActionOptions(argv = process.argv.slice(2)): Record<string, string> {
  const { options } = parseArgv(argv, { coerceValues: false })
  const values = new Set(['add', 'queue', 'id', 'for', 'concurrency', 'interval', 'limit', 'name', 'olderThanDays', 'reason', 'since', 'status'])
  for (const [key, value] of Object.entries(options)) {
    if (values.has(key) && typeof value !== 'string') throw new TypeError(`--${key} requires a value`)
  }
  return Object.fromEntries(Object.entries(options).map(([key, value]) => [key, String(value)]))
}
