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

/** Every model, by the name the ORM exposes it under. */
type Models = typeof import('../auto-imports/models')

/** The application's own `app/Gates.ts`, as it is written. */
type Authorization = typeof import('../../../app/Gates')['default']

/**
 * The ability names its gates define, and the arguments each one takes.
 *
 * Bound with `infer` rather than looked up as `Authorization['gates']` behind
 * an `extends GatesDefinition` check. That check passes, but inside its true
 * branch the lookup reads back through the constraint's own index signature -
 * `Readonly<Record<string, GateCallback>>` - so `keyof` came out `string`.
 * `AppGates` then had a string index signature, `GateName` was `string`, and
 * nothing was constrained: `Gate.allows('definitely-not-a-real-gate', user)`
 * typechecked, which is exactly what this file exists to prevent.
 *
 * `A extends { gates: infer G }` binds the real object, so the names survive.
 * It also still degrades to nothing rather than to an error when a project has
 * replaced `Gates.ts` with something of another shape.
 */
type GateNames = Authorization extends { gates: infer G }
  ? Extract<keyof G, string>
  : never

/**
 * Each gate mapped to the arguments it takes AFTER the user.
 *
 * The registry used to map every name to `true`, recording that a gate existed
 * and nothing about how to call it, so `Gate.allows('view-dashboard', user,
 * 'junk', 42)` passed against a gate declared `(user) => boolean`.
 */
type GateArgsOf = Authorization extends { gates: infer G }
  ? {
      [K in Extract<keyof G, string>]: G[K] extends (..._args: infer P) => unknown
        ? (P extends [unknown, ...infer Rest] ? Rest : [])
        : never
    }
  : Record<never, never>

declare module '@stacksjs/auth' {
  interface AppGates extends GateArgsOf {}
  interface PolicyModels extends Record<keyof Models & string, true> {}
}

export {}
