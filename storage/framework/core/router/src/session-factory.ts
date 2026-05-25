/**
 * Stacks session-store factory (stacksjs/stacks#1889, F-2 from #1874).
 *
 * Background: `@stacksjs/bun-router` ships four session stores
 * (memory / file / redis / database) plus a `createSessionStore(config)`
 * factory, AND the Stacks-side `EncryptedSessionStore` from #1878
 * Se-4 wraps any of them with AES-GCM encryption-at-rest. Apps that
 * wanted both had to wire it up themselves.
 *
 * Fix: this module provides a single Stacks-level
 * {@link createStacksSessionStore} that:
 *
 *   1. Reads `config.session` (Stacks's typed session config)
 *   2. Calls bun-router's `createSessionStore` to build the
 *      base store
 *   3. Optionally wraps with `EncryptedSessionStore` (default ON
 *      in production, off in dev/test)
 *
 * Apps just pass their config; the factory handles driver
 * selection + encryption. Mirrors the email / queue driver
 * registries' shape.
 */

import process from 'node:process'
import type { RedisClient, SessionConfig, SessionData, SessionStore } from '@stacksjs/bun-router'
import { createSessionStore } from '@stacksjs/bun-router'
import { EncryptedSessionStore } from './encrypted-session-store'

/**
 * Stacks-level session configuration. Extends bun-router's
 * {@link SessionConfig} with:
 *
 *   - `encrypt`: opt-in/out of {@link EncryptedSessionStore}
 *     wrapping (default: `'auto'` — on in production, off in
 *     dev/test where readability matters more than encryption-
 *     at-rest)
 *   - `appKey`: override key for the encryption (defaults to
 *     `process.env.APP_KEY`)
 *
 * All other fields pass through to bun-router unchanged.
 */
export interface StacksSessionConfig extends SessionConfig {
  /**
   * Whether to wrap the underlying store with
   * {@link EncryptedSessionStore} (stacksjs/stacks#1878 Se-4).
   *
   *   - `'auto'` (default) — encrypt in production; raw in dev/test
   *   - `true` — always encrypt
   *   - `false` — never encrypt
   */
  encrypt?: boolean | 'auto'
  /**
   * App key used by the encrypted wrapper. Defaults to
   * `process.env.APP_KEY`. Throws at factory time if encryption
   * is enabled and no key is available.
   */
  appKey?: string
}

/**
 * Build a session store from the Stacks config. Mirrors what
 * `mail` / `Jobs` do for their driver registries — call once at
 * boot, pass the result into the session middleware.
 *
 * @example
 * ```ts
 * // config/session.ts (typical)
 * export const session = {
 *   driver: 'redis',
 *   ttl: 60 * 60 * 24,         // 24h
 *   cookie: { name: 'sid', httpOnly: true, sameSite: 'lax' },
 *   redis: { client: useRedis() },
 * } satisfies StacksSessionConfig
 *
 * // Then at boot:
 * const store = createStacksSessionStore(session)
 * app.use(sessionMiddleware({ store }))
 * ```
 */
export function createStacksSessionStore(config: StacksSessionConfig): SessionStore<SessionData> {
  const base = createSessionStore(config)

  const shouldEncrypt = resolveEncryptionMode(config.encrypt)
  if (!shouldEncrypt) return base

  const appKey = config.appKey ?? process.env.APP_KEY
  if (!appKey || appKey.length < 16) {
    throw new Error(
      '[session] createStacksSessionStore: encryption requested but APP_KEY is missing or too short '
      + '(need ≥16 chars). Either set APP_KEY in env, pass `appKey` in config, or set `encrypt: false` to opt out.',
    )
  }

  return new EncryptedSessionStore(base, { appKey })
}

function resolveEncryptionMode(mode: StacksSessionConfig['encrypt']): boolean {
  if (mode === true) return true
  if (mode === false) return false
  // 'auto' or undefined — production-default-on
  const env = (process.env.APP_ENV ?? process.env.NODE_ENV ?? '').toLowerCase()
  return env === 'production'
}

// Re-export bun-router's session types so app code only has to
// import from `@stacksjs/router` (one less package boundary to
// learn). Drivers stay accessible by name for callers that want
// to assemble a custom store manually.
export type {
  RedisClient,
  SessionConfig,
  SessionData,
  SessionStore,
}

export {
  DatabaseSessionStore,
  FileSessionStore,
  MemorySessionStore,
  RedisSessionStore,
  createSessionStore,
} from '@stacksjs/bun-router'
