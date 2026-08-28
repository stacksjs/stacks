// Gates and policies, derived rather than listed.
//
// Both halves of `app/Gates.ts` name things that exist elsewhere - an ability
// the file itself defines, and a model the ORM exposes - and both used to be
// `string`. A mapping to a policy that is not there, or for a model that is not
// there, registered nothing and then denied every check against it, which is
// indistinguishable from a policy that means to say no.
//
// Nothing here is generated. The gates ARE the declaration, read back off the
// file, and the models come from the same barrel `injectGlobalAutoImports`
// loads at runtime - so neither can drift from what the application has.

import type { GatesDefinition } from '@stacksjs/auth'

/** Every model, by the name the ORM exposes it under. */
type Models = typeof import('../auto-imports/models')

/** The application's own `app/Gates.ts`, as it is written. */
type Authorization = typeof import('../../../app/Gates')['default']

/**
 * The ability names its gates define.
 *
 * Guarded on `GatesDefinition` so a project whose `Gates.ts` has been replaced
 * with something else falls back to "any ability" rather than to a type error
 * in a declaration file it never wrote.
 */
type GateNames = Authorization extends GatesDefinition
  ? keyof Authorization['gates'] & string
  : never

declare module '@stacksjs/auth' {
  interface AppGates extends Record<GateNames, true> {}
  interface PolicyModels extends Record<keyof Models & string, true> {}
}

export {}
