/**
 * Role requirements for the framework's own dashboard route groups
 * (stacksjs/stacks#2883).
 *
 * The 24 groups in `defaults/routes/dashboard.ts` ship `middleware: 'auth'` and
 * nothing more, so every signed-in user can reach `/api/commerce`, `/cms` and
 * the rest whatever the sidebar shows them. An app could not change that: the
 * file is framework-owned, there is no global middleware stack, and no config
 * attached middleware to a path. The gap was not only the permissive default,
 * it was having no way to tighten it short of vendoring the routes file.
 *
 * `config/dashboard.ts` now carries an `access` map, keyed by the group prefix:
 *
 * ```ts
 * access: {
 *   '/api/commerce': ['admin', 'superadmin'],
 *   '/cms': ['admin', 'editor'],
 * }
 * ```
 *
 * Keyed by prefix rather than by dashboard section because a section has no
 * one path: the sidebar's commerce section points at `/commerce/*` pages while
 * its API lives at `/api/commerce/*` and `/dashboard/commerce/*`, and a
 * framework-owned section-to-prefix mapping would be guessing on behalf of the
 * app in exactly the places that matter. A prefix is what the group actually
 * is.
 *
 * Omitted leaves a group exactly as it was, `auth` alone, so an upgrade changes
 * no application.
 */

import type { MiddlewareReference } from '@stacksjs/bun-router/runtime'

/**
 * Every group an app may gate, and the single source of truth for the
 * `DashboardRouteGroup` union in `@stacksjs/types`.
 *
 * `dashboard-access.test.ts` pins this list, that union and the prefixes
 * `defaults/routes/dashboard.ts` actually registers against each other. Three
 * copies of one list is a mirror, and mirrors drift: a group added to the
 * routes file and not to this one is a group an app silently cannot gate.
 */
export const DASHBOARD_ROUTE_GROUPS = [
  '/ai',
  '/api/analytics',
  '/api/commerce',
  '/api/data',
  '/api/marketing',
  '/api/monitoring',
  '/api/notifications',
  '/api/queries',
  '/api/settings',
  '/cms',
  '/dashboard',
  '/dashboard/cms',
  '/dashboard/commerce',
  '/deployments',
  '/infrastructure',
  '/jobs',
  '/library',
  '/models',
  '/payments',
  '/queue',
  '/queues',
  '/realtime',
  '/releases',
  '/voide',
] as const

export type DashboardRouteGroupPrefix = (typeof DASHBOARD_ROUTE_GROUPS)[number]

export interface DashboardAccess {
  /** Prefix to the roles that may reach it. Only non-empty entries are kept. */
  roles: Map<string, string[]>
  /** Keys that name no group this framework registers, for one boot warning. */
  unknown: string[]
}

/**
 * Read `dashboard.access` into a prefix-to-roles map.
 *
 * Tolerant by design: this runs at route-registration time, on a value an app
 * wrote, and a malformed entry must not take the dashboard down. Anything that
 * is not a prefix with at least one non-empty role name is dropped, and a key
 * naming no known group is collected for the caller to report rather than
 * silently ignored - a typo'd prefix would otherwise read as a gate that is
 * quietly absent, which is the failure this whole surface exists to stop.
 *
 * An entry with an empty role list is treated as unset rather than as "nobody":
 * the base middleware still applies, and an app cannot lock itself out of its
 * own dashboard with `[]`.
 */
export function resolveDashboardAccess(configured: unknown): DashboardAccess {
  const roles = new Map<string, string[]>()
  const unknown: string[] = []

  if (!configured || typeof configured !== 'object' || Array.isArray(configured))
    return { roles, unknown }

  const known = new Set<string>(DASHBOARD_ROUTE_GROUPS)

  for (const [key, value] of Object.entries(configured as Record<string, unknown>)) {
    const prefix = key.trim()
    if (!prefix)
      continue

    if (!known.has(prefix)) {
      unknown.push(prefix)
      continue
    }

    const names = (Array.isArray(value) ? value : [value])
      .filter((name): name is string => typeof name === 'string')
      .map(name => name.trim())
      .filter(name => name.length > 0)

    if (names.length > 0)
      roles.set(prefix, names)
  }

  return { roles, unknown }
}

/**
 * The middleware list for one group: its base, plus the role gate if the app
 * declared one.
 *
 * One `role:a,b` entry rather than one per role, because that is Role.ts's
 * any-of form and matches what a list of roles means everywhere else in the
 * framework. Appended after the base so `auth` runs first and the role check
 * never asks the roles of nobody.
 */
export function dashboardGroupMiddleware(
  prefix: string,
  access: DashboardAccess,
  base: readonly MiddlewareReference[] = ['auth'],
): MiddlewareReference[] {
  const names = access.roles.get(prefix)

  // `role` is an alias in `defaults/app/Middleware.ts`, so `role:${string}` is
  // a MiddlewareReference by construction and needs no cast. Typed rather than
  // `string[]` because `route.group` takes references, and a plain string array
  // would have to be cast at all 24 call sites.
  return names ? [...base, `role:${names.join(',')}`] : [...base]
}

/**
 * The one-line boot report about `access` keys naming no known group.
 *
 * Returns null when there is nothing to report, matching the ORM's sibling
 * reports.
 */
export function describeUnknownDashboardGroups(unknown: readonly string[]): string | null {
  if (unknown.length === 0)
    return null

  return `[dashboard] config/dashboard.ts \`access\` names ${unknown.length === 1 ? 'a route group' : 'route groups'} this framework does not register, so ${unknown.length === 1 ? 'it gates' : 'they gate'} nothing: `
    + `${[...unknown].sort().join(', ')}. Valid prefixes are ${DASHBOARD_ROUTE_GROUPS.join(', ')}.`
}
