/**
 * `env`, typed from `config/env.ts`.
 *
 * The application used to write the augmentation itself, at the bottom of the
 * file it had just filled in:
 *
 *   declare module '@stacksjs/env' {
 *     interface StacksEnv extends InferEnv<typeof envSchema> {}
 *   }
 *
 * Boilerplate with exactly one correct spelling, and nothing to say when it is
 * missing - every variable in the schema simply stays untyped. The framework
 * reads the schema itself now, from
 * `storage/framework/types/env.d.ts`.
 *
 * Before that it was generated: a `Bun.env` namespace whose key set came from
 * whichever `.env` was on the machine running the generator, and whose types
 * came from each variable's live value there. A production-only variable could
 * never be typed, and the same variable could be `number` on one checkout and
 * `string` on another. Nothing here executes; it is checked by
 * `bun run typecheck`.
 */

import type { StacksEnv } from '../src/types'
import { env } from '../src'

// ── each variable is typed by its validator ───────────────────────────────

// `schema.string()`
export const appName: string | undefined = env.APP_NAME

// `schema.number()` - a number, not the string the process actually holds.
export const port: number | undefined = env.PORT

// `schema.boolean()`
export const debug: boolean | undefined = env.DEBUG

// `schema.enum([...])` is the union of those literals, not `string`.
export const connection: 'mysql' | 'sqlite' | 'postgres' | 'singlestore' | 'vitess' | undefined = env.DB_CONNECTION

export function wrongTypes(): void {
  // @ts-expect-error PORT is a number
  const asString: string | undefined = env.PORT
  void asString

  // @ts-expect-error 'mariadb' is not one of the declared connections
  const badEnum: typeof env.DB_CONNECTION = 'mariadb'
  void badEnum
}

// ── every variable is optional, because the process may not have it ───────

export function optionality(): void {
  // @ts-expect-error the process may simply not have APP_KEY set
  const required: string = env.APP_KEY
  void required
}

// ── the framework's own variables are still there ─────────────────────────

// Declared by `FrameworkEnv`, not by `config/env.ts`, and merging one set into
// the other must not drop the other.
export const awsBucket: string | undefined = env.AWS_BUCKET
export const redisHost: string | undefined = env.REDIS_HOST

// ── the schema's keys reached `StacksEnv` at all ──────────────────────────

/*
 * The load-bearing assertion. If the derivation stops resolving -
 * `config/env.ts` moves, the relative path in `types/env.d.ts` breaks, the
 * default export changes shape - `StacksEnv` quietly falls back to the
 * framework's own set and every application variable types as `undefined`
 * through the index signature. Naming one here fails the build instead.
 */
type HasKey<TKey extends keyof StacksEnv> = TKey
export type DeclaredHere = HasKey<'FRONTEND_APP_URL' | 'MEILISEARCH_KEY' | 'DB_POOL_MAX'>

export const ok = true
