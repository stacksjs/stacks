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

import type { Ability, GatesDefinition, PolicyMapping, PolicyModelName, PolicyName } from '../src/gate'
import { defineGates } from '../src/gate'

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
