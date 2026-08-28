// The application's environment variables, derived rather than generated.
//
// `config/env.ts` declares them with `defineEnv`, and this teaches `env` about
// them. The application used to have to write that itself, at the bottom of the
// file it had just filled in:
//
//   declare module '@stacksjs/env' {
//     interface StacksEnv extends InferEnv<typeof envSchema> {}
//   }
//
// which is boilerplate that only ever has one correct spelling, and silently
// leaves every variable untyped when it is missing. The framework can read the
// schema itself.
//
// `@stacksjs/env` cannot do this from inside the package: a published `.d.ts`
// naming `../../../config/env` resolves to nothing under `node_modules/`. So it
// lives here, in the project, alongside the other derivations.

import type { InferEnv } from '@stacksjs/env'

/** The schema `config/env.ts` default-exports. */
type EnvSchema = typeof import('../../../config/env')['default']

declare module '@stacksjs/env' {
  /**
   * Each variable typed by its validator - `schema.number()` is a `number`,
   * `schema.enum([...])` the union of those literals - and optional, because
   * the process may simply not have it set. `InferEnv` drops the keys the
   * framework already declares, so restating one cannot conflict.
   */
  interface StacksEnv extends InferEnv<EnvSchema> {}
}

export {}
