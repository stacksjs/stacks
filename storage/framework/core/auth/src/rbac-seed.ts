/**
 * Default RBAC role packs (stacksjs/stacks#1843).
 *
 * Seeds the three role records every Stacks dashboard understands by
 * name — `admin`, `dev`, `client`. Permissions are intentionally NOT
 * seeded here: the dashboard's `useRole()` composable reads role names
 * directly (no per-permission resolution), and projects layer their own
 * permission taxonomy when they need finer-grained authorisation.
 *
 * Why ship defaults at all?
 *
 *   A fresh `./buddy migrate` leaves `roles` empty. Every call to
 *   `assignRole(user, 'admin')` then throws "Role 'admin' not found"
 *   because the named row doesn't exist yet. Forcing every new project
 *   to run `createRole('admin')` before anything works is a footgun;
 *   shipping the standard trio lets the role-aware sidebar / `useRole()`
 *   chain function out of the box.
 *
 * What about idempotency?
 *
 *   Re-running the seeder is safe — each role is upserted via
 *   `findRoleByName` first; existing records are left alone. So
 *   `./buddy seed:roles` can be called by CI, by post-deploy hooks, or
 *   manually after a `migrate:fresh` without worrying about duplicates
 *   or wiping role assignments.
 */

import type { RoleRecord } from './rbac'
import { createRole, findRole } from './rbac'

/**
 * The role packs every Stacks install starts with. `useRole()`'s built-in
 * predicates (`isAdmin`, `isDev`, `isClient`) check these names verbatim,
 * so renaming them in a project effectively unbinds the composable from
 * its defaults — that's fine, but obvious to readers.
 */
export const DEFAULT_ROLE_PACKS: Array<{ name: string, guard_name: string, description: string }> = [
  {
    name: 'admin',
    guard_name: 'web',
    description: 'Full access. Sees every dashboard surface, every model, every infra control.',
  },
  {
    name: 'dev',
    guard_name: 'web',
    description: 'Developer / infra. Sees dev-mode surfaces (CI, query inspector, runner alerts) but not billing/admin-only management.',
  },
  {
    name: 'client',
    guard_name: 'web',
    description: 'End user / client. Sees content, orders, profile, billing — no dev tools, no infra surfaces.',
  },
]

export interface SeedDefaultRolesResult {
  created: RoleRecord[]
  skipped: Array<{ name: string, guard_name: string, reason: 'already_exists' }>
}

/**
 * Idempotently seed the three default role packs. Existing role records
 * with the same `(name, guard_name)` are left untouched.
 *
 * Throws only if the underlying `createRole` throws for a reason other
 * than a unique-constraint race (the BqbRbacStore's `swallowDuplicate`
 * already handles that case). Caller should typically log the error and
 * surface it — a missing roles table means the migrations haven't run
 * yet, which is a different bug than a seeder failure.
 */
export async function seedDefaultRoles(): Promise<SeedDefaultRolesResult> {
  const created: RoleRecord[] = []
  const skipped: SeedDefaultRolesResult['skipped'] = []

  for (const pack of DEFAULT_ROLE_PACKS) {
    const existing = await findRole(pack.name, pack.guard_name)
    if (existing) {
      skipped.push({ name: pack.name, guard_name: pack.guard_name, reason: 'already_exists' })
      continue
    }
    const role = await createRole(pack.name, pack.guard_name, pack.description)
    created.push(role)
  }

  return { created, skipped }
}
