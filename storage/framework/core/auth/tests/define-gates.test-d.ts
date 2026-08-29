/**
 * `app/Gates.ts`, typed.
 *
 * Both halves of a policy mapping name something that exists elsewhere - a
 * model the ORM exposes, and a policy file on disk - and both were `string`:
 * `policies: Record<string, string | { policy: string, model?: string }>`. A
 * mapping to a policy that is not there registers nothing, and an unregistered
 * policy denies every check against that model, which is exactly what a policy
 * that means to say no looks like. Nothing here executes; it is checked by
 * `bun run typecheck`.
 */

import type { UserModel } from '@stacksjs/orm'
import type { Ability, GatesDefinition, PolicyMapping, PolicyModelName, PolicyName } from '../src/gate'
import { defineGates } from '../src/gate'
import { Gate } from '../src/gate'

// ── the good case, and what it keeps ──────────────────────────────────────

const authorization = defineGates({
  gates: {
    'access-admin': user => user?.email?.endsWith('@stacksjs.org') ?? false,
    'view-dashboard': user => user !== null,
  },
  policies: {
    Post: 'PostPolicy',
  },
})

// The ability names stay exactly what the file declares. This is what
// `storage/framework/types/gates.d.ts` reads back to fill `AppGates`.
export const declaredAbilities: 'access-admin' | 'view-dashboard' = '' as keyof typeof authorization.gates

// ── a model that does not exist ───────────────────────────────────────────

export function unknownModel(): void {
  defineGates({
    gates: {},
    // @ts-expect-error there is no Psot model
    policies: { Psot: 'PostPolicy' },
  })
}

/*
 * The same typo beside a valid entry - the case a plain constraint misses,
 * because excess-property checking stops applying once inference has a
 * matching property to work with.
 */
export function unknownModelBesideAGoodOne(): void {
  defineGates({
    gates: {},
    // @ts-expect-error there is no Psot model
    policies: { Psot: 'PostPolicy', Post: 'PostPolicy' },
  })
}

// ── a policy that is not on disk ──────────────────────────────────────────

export function unknownPolicy(): void {
  defineGates({
    gates: {},
    // @ts-expect-error there is no PsotPolicy under app/Policies or the defaults
    policies: { Post: 'PsotPolicy' },
  })
}

// ── the optional halves stay optional ─────────────────────────────────────

export const gatesOnly = defineGates({
  gates: { 'edit-settings': user => user !== null },
})

// ── before/after carry their arguments, rather than `any[]` ───────────────

export const withCallbacks = defineGates({
  gates: {},
  before: [
    (user, ability, args) => {
      void user
      void ability
      // `unknown[]`, so a caller has to look before it leaps.
      const first: unknown = args[0]
      void first
      return null
    },
  ],
  after: [
    (user, ability, result) => {
      void user
      void ability
      const allowed: boolean = result
      void allowed
    },
  ],
})

// ── the names the map is built from ───────────────────────────────────────

export const aModel: PolicyModelName = 'Post'
export const aPolicy: PolicyName = 'PostPolicy'
export const mapping: PolicyMapping = { Post: 'PostPolicy' }
export const definition: GatesDefinition = authorization

/*
 * An ability stays open on purpose. A `/can/:ability` route passes one straight
 * through - which is the reason `RESERVED_POLICY_MEMBERS` exists - so narrowing
 * this to the declared set would reject correct code and make the fail-closed
 * tests for unknown abilities impossible to write.
 */
export const declared: Ability = 'access-admin'
export const policyMethod: Ability = 'update'
export const dynamic: Ability = 'whatever-a-route-param-said'

export const ok = true

// ── the arguments a gate takes, at the call site ──────────────────────────

/*
 * `AppGates` used to map every ability to `true`: it recorded that a gate
 * existed and nothing about how to call it, so a gate declared `(user) =>
 * boolean` accepted any number of extra arguments at every call site.
 *
 * It recorded less than that, in fact. The names were derived through
 *
 *   Authorization extends GatesDefinition ? keyof Authorization['gates'] : never
 *
 * and although that check passes, the lookup inside its true branch reads back
 * through the constraint's own index signature - `Readonly<Record<string,
 * GateCallback>>` - so `keyof` came out `string`. `AppGates` got a string index
 * signature and NOTHING was constrained, which is the opposite of what
 * `storage/framework/types/gates.d.ts` exists to do. Binding the object with
 * `infer` keeps the literal keys.
 */

// A gate's declared parameters survive `defineGates`, which is what the
// registry reads. If this widens to `GateCallback` again, the registry that
// derives from it silently stops constraining anything.
export const gateKeepsItsSignature: (user: UserModel | null) => boolean
  = authorization.gates['view-dashboard']

// The keys stay a literal union rather than collapsing to `string`.
export type DeclaredGateNames = keyof typeof authorization.gates
export const namesAreLiteral: 'access-admin' | 'view-dashboard' = '' as DeclaredGateNames

// @ts-expect-error - 'not-a-declared-gate' is not one of the two above.
export const rejectsUnknownName: DeclaredGateNames = 'not-a-declared-gate'

// ── every single-ability check is held to the same declaration ────────────

/*
 * `allows` was typed first and its siblings were left on `...args: any[]`, so
 * which spelling you reached for decided whether the call was checked. They
 * agree now.
 *
 * `any` / `all` / `none` deliberately keep `any[]`: one argument list is
 * checked against several abilities, which may each declare different
 * parameters, so no single tuple is correct for the call.
 */
declare const someone: UserModel | null

export async function everyCheckerAgrees(): Promise<void> {
  // `view-dashboard` is declared `(user) => boolean` above: no extra arguments.
  await Gate.allows('view-dashboard', someone)
  await Gate.denies('view-dashboard', someone)
  await Gate.can('view-dashboard', someone)
  await Gate.cannot('view-dashboard', someone)
  await Gate.inspect('view-dashboard', someone)
  await Gate.authorize('view-dashboard', someone)
}

export async function everyCheckerRejectsExtras(): Promise<void> {
  // @ts-expect-error - the gate declares no arguments after the user.
  await Gate.allows('view-dashboard', someone, 'extra')
  // @ts-expect-error - denies is held to the same declaration.
  await Gate.denies('view-dashboard', someone, 'extra')
  // @ts-expect-error - and can.
  await Gate.can('view-dashboard', someone, 'extra')
  // @ts-expect-error - and cannot.
  await Gate.cannot('view-dashboard', someone, 'extra')
  // @ts-expect-error - and inspect.
  await Gate.inspect('view-dashboard', someone, 'extra')
  // @ts-expect-error - and authorize.
  await Gate.authorize('view-dashboard', someone, 'extra')
}

/*
 * An ability that is not a declared gate stays open, and that is deliberate:
 * a policy may add its own methods, and a `/can/:ability` route passes one
 * straight through. The policy name map stores FILE PATHS rather than class
 * types - on purpose, so resolving one name does not pull in every policy
 * module - so a policy's method names are not derivable here, and closing
 * `Ability` would reject correct calls.
 */
export async function dynamicAbilitiesStillCompile(routeParam: string): Promise<void> {
  await Gate.allows(routeParam, someone)
  await Gate.allows('publish', someone, { id: 1 })
}
