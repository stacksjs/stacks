import process from 'node:process'

/**
 * The variable a parent process sets to keep keys out of a child it spawns.
 *
 * Deleting a key before spawning does not keep it out of the child: Bun loads
 * `.env` natively, and `loadEnv` fills anything absent, so the child reads the
 * deleted value straight back from disk. That is how `buddy release:ios`
 * shipped a `localhost` dev server in a release build (stacksjs/stacks#3028).
 * A parent that needs a key absent names it here instead, and the child's
 * loaders honour that whichever file defines it.
 */
export const WITHHELD_ENV = 'STACKS_ENV_WITHHOLD'

/** The keys this process's parent withheld from it. */
export function withheldEnvKeys(env: Record<string, string | undefined> = process.env): Set<string> {
  return new Set((env[WITHHELD_ENV] ?? '').split(',').map(key => key.trim()).filter(Boolean))
}

/**
 * The environment entries that withhold `keys` from a child process, to
 * spread into the child's `env`. Keys only, never values.
 */
export function withholdEnv(keys: readonly string[]): Record<string, string> {
  const merged = new Set([...withheldEnvKeys(), ...keys])
  return { [WITHHELD_ENV]: [...merged].join(',') }
}

/**
 * Remove every withheld key from `env`, including a copy Bun loaded from a
 * file before any of this process's code ran. Returns the keys removed.
 */
export function applyWithheldEnv(env: Record<string, string | undefined> = process.env): string[] {
  const removed: string[] = []
  for (const key of withheldEnvKeys(env)) {
    if (key in env) {
      delete env[key]
      removed.push(key)
    }
  }
  return removed
}
