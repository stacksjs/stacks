/**
 * `env` is typed from `config/env.ts`, not from a generated file.
 *
 * These never run: `bun run typecheck:types` failing is the assertion. They
 * guard the two properties that make generation unnecessary - a variable's
 * type comes from its validator rather than from whatever value happened to be
 * set on the machine that generated the declarations, and a variable declared
 * only in the schema (never in any `.env`) is typed all the same.
 */
import type { InferEnv } from '../src/types'
import { schema } from '@stacksjs/validation'
import { defineEnv } from '../src/types'

type Expect<T extends true> = T
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false

const envSchema = defineEnv({
  // Set nowhere on this machine, and typed regardless.
  STRIPE_WEBHOOK_SECRET: { validation: schema.string(), default: '' },
  AI_FIX_TIMEOUT_MS: { validation: schema.number(), default: 90_000 },
  AI_FIX_ENABLED: { validation: schema.boolean(), default: false },
  LOG_LEVEL: { validation: schema.enum(['debug', 'info', 'error']), default: 'info' },
  // A key the framework already declares.
  APP_NAME: { validation: schema.string(), default: 'Stacks' },
})

type Inferred = InferEnv<typeof envSchema>

export type _String = Expect<Equal<Inferred['STRIPE_WEBHOOK_SECRET'], string | undefined>>
export type _Number = Expect<Equal<Inferred['AI_FIX_TIMEOUT_MS'], number | undefined>>
export type _Boolean = Expect<Equal<Inferred['AI_FIX_ENABLED'], boolean | undefined>>
// The literals survive, so `env.LOG_LEVEL === 'debug'` is a real comparison
// rather than two strings.
export type _Enum = Expect<Equal<Inferred['LOG_LEVEL'], 'debug' | 'info' | 'error' | undefined>>

// Framework keys are dropped. Restating one with a different type is what
// makes a merged interface declaration fail to compile.
export type _SkipsFrameworkKeys = Expect<Equal<'APP_NAME' extends keyof Inferred ? true : false, false>>

// The augmentation an application writes in config/env.ts.
declare module '../src/types' {
  interface StacksEnv extends InferEnv<typeof envSchema> {}
}
