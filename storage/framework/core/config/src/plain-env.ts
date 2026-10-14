/**
 * `process.env` reads that treat dotenvx-style ciphertext as absent.
 *
 * `@stacksjs/env` already holds this rule twice. Its proxy decrypts on read
 * and scrubs a value no key can open, so `env.PORT ?? 3000` resolves to the
 * default; its preloader scrubs ciphertext Bun left in `process.env`, because
 * Bun auto-loads `.env` and knows nothing about encryption. Both say the same
 * thing: ciphertext is unusable to every consumer, so it never wins.
 *
 * This package reads a handful of variables straight from `process.env` and so
 * honoured neither. It cannot use the proxy. These reads run at module init,
 * and importing `@stacksjs/env` for them would put its loader, CLI and plugin
 * surface into the init path that `overridesReady` exists to keep untangled.
 *
 * So the rule is restated here, and `tests/plain-env.test.ts` fails if this
 * copy and `isEncryptedValue` ever disagree.
 *
 * Without it, any command that skips the env preloader boots with `app.env`
 * set to 300 characters of base64. Validation then rejects a config that is
 * correct and throws, naming the ciphertext rather than the missing key
 * (stacksjs/stacks#2903).
 */

/**
 * Whether a value is ciphertext rather than something a consumer can use.
 *
 * Both prefixes dotenvx writes, kept in step with `isEncryptedValue` in
 * `@stacksjs/env`.
 */
export function isCiphertext(value: unknown): boolean {
  return typeof value === 'string' && (value.startsWith('encrypted:') || value.startsWith('enc:'))
}

/**
 * Read `key` from the environment, or `undefined` when it holds ciphertext.
 *
 * "Absent" is the honest reading of a value nothing can open, and it lets the
 * `|| default` beside each call resolve exactly as it does when the variable
 * was never set.
 */
export function plainEnv(key: string): string | undefined {
  const value = process.env[key]
  return isCiphertext(value) ? undefined : value
}
