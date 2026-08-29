import type { TeamAuthRequest } from '@stacksjs/auth'
import { resolveAuthenticatedTeamId } from '@stacksjs/auth'
import { db } from '@stacksjs/database'
import { currentSiteId } from './context'
import { SiteNotResolvedError } from './context'

/**
 * Scope a query to the ambient site. EXPLICIT by design: the generated
 * `Model.where()` statics have no interception point for an automatic global
 * scope, and an ALS-driven implicit one would silently vanish in queue
 * workers, cron and the CLI - exactly where a missing scope becomes a
 * cross-tenant leak. A visible `forSite(...)` is grep-able and auditable.
 */
// eslint-disable-next-line pickier/no-unused-vars -- `args` names the variadic in the structural type only
export function forSite<QB extends { where: (...args: any[]) => QB }>(
  qb: QB,
  column = 'site_id',
  siteId: number | undefined = currentSiteId(),
): QB {
  if (siteId == null)
    throw new SiteNotResolvedError('No site in request context')
  return qb.where(column, '=', siteId)
}

/**
 * `model.ownership` config for ADMIN surfaces (dashboard editing of
 * site-scoped content through `useApi` routes): the authenticated user may
 * touch rows belonging to any site their active team owns. Public site reads
 * never ride this - they go through dedicated routes that call
 * `requireSite()` and scope by the request's host instead.
 */
export function siteOwnership(): {
  field: string
  resolve: (user: unknown, req: unknown) => Promise<number[] | null>
} {
  return {
    field: 'site_id',
    resolve: async (_user: unknown, req: unknown) => {
      // `TeamAuthRequest` is structural with every member optional by design -
      // a partial object resolves to "unauthenticated" rather than crashing -
      // so this narrows to "something that may answer bearerToken/cookies",
      // not to a concrete request class. The ownership contract genuinely
      // hands this callback an arbitrary request.
      const teamId = await resolveAuthenticatedTeamId((req ?? {}) as TeamAuthRequest)
      if (!teamId)
        return null

      const rows = await db
        .selectFrom('sites')
        .where('team_id', '=', teamId)
        .select(['id'])
        .execute() as { id: number }[]

      return rows.map(row => Number(row.id))
    },
  }
}
