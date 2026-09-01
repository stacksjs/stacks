/**
 * Ready-made `ownership` resolvers for the shapes that recur across the
 * framework's own models (stacksjs/stacks#2375).
 *
 * `security.api.rowScoping` defaults to `'deny'`, so a model that says nothing
 * about who owns a row gets no generated `store` / `update` / `destroy`. Most
 * models do not need this file at all - a `team_id` or `user_id` column is
 * detected automatically - but ownership held one hop away is not derivable,
 * and writing the same resolver into a dozen models is how they drift apart.
 *
 * Every resolver here takes the owner identity from the AUTHENTICATED USER and
 * never from the request body or query string. That is the property that makes
 * scoping worth anything: a caller must not be able to widen their own scope by
 * POSTing somebody else's id.
 */

/**
 * Adapt a raw request to the `{ bearerToken, cookies }` shape @stacksjs/auth's
 * team resolver expects.
 *
 * The auto-CRUD paths read the Authorization header directly rather than
 * relying on `req.bearerToken()` being wired, so the credential is surfaced
 * from the header and the cookie header is parsed for the session cookie.
 */
export function teamAuthRequest(req: any): { bearerToken: () => string | null, cookies: { get: (name: string) => string | null } } {
  const header = req?.headers?.get?.('authorization') as string | null
  const token = header && /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : null
  const cookieHeader = (req?.headers?.get?.('cookie') as string | null) || ''

  return {
    bearerToken: () => token,
    cookies: {
      get: (name: string) => {
        for (const part of cookieHeader.split(';')) {
          const eq = part.indexOf('=')
          if (eq === -1)
            continue
          if (part.slice(0, eq).trim() === name)
            return decodeURIComponent(part.slice(eq + 1).trim())
        }
        return null
      },
    },
  }
}

/**
 * Rows owned by the caller's customer record.
 *
 * The commerce models hang off `Customer`, not `User` - an order belongs to a
 * customer, and a customer belongs to a user - so the owner value is one hop
 * away and has to be looked up. Returns `null` for a user with no customer
 * record, which `ownsRow` treats as owning nothing rather than as owning
 * everything.
 */
export function customerOwnership(field = 'customer_id'): {
  field: string
  resolve: (user: any) => Promise<number | null>
} {
  return {
    field,
    resolve: async (user: any) => {
      const userId = user?.id
      if (userId == null)
        return null

      try {
        const { Customer } = await import('@stacksjs/orm')
        const customer = await (Customer as any).where('user_id', userId).first()
        return customer?.id ?? null
      }
      catch {
        // A model-less or unmigrated Customer table must not hand out access.
        return null
      }
    },
  }
}

/**
 * Rows the caller owns directly, keyed by the user's own id.
 *
 * For `User` itself, where the owner column IS the primary key: a caller may
 * write their own row and no other. Without this, `User` is the worst case the
 * issue describes - an authenticated caller able to `PATCH /api/users/{any}`.
 */
export function selfOwnership(field = 'id'): {
  field: string
  resolve: (user: any) => Promise<number | null>
} {
  return {
    field,
    resolve: async (user: any) => user?.id ?? null,
  }
}

/**
 * Rows owned through the caller's team, two hops away, via `Site`.
 *
 * A page belongs to a site and a site belongs to a team, so there is no single
 * owner id to compare against - the answer is the SET of site ids the caller's
 * team owns. `ownsRow` accepts an array for exactly this case, and a caller
 * whose team owns no sites gets an empty set, which owns nothing.
 */
export function siteOwnership(field = 'site_id'): {
  field: string
  resolve: (user: any, req: any) => Promise<number[]>
} {
  return {
    field,
    resolve: async (_user: any, req: any) => {
      try {
        const [{ resolveAuthenticatedTeamId }, { Site }] = await Promise.all([
          import('@stacksjs/auth'),
          import('@stacksjs/orm'),
        ])

        const teamId = await resolveAuthenticatedTeamId(teamAuthRequest(req))
        if (teamId == null)
          return []

        const sites = await (Site as any).where('team_id', teamId).get()
        return (sites ?? []).map((site: any) => site.id).filter((id: unknown) => id != null)
      }
      catch {
        // Owning nothing is the safe answer; owning everything is not.
        return []
      }
    },
  }
}

/**
 * The team row the caller is actually a member of.
 *
 * `Team`'s owner column is its own primary key, and membership is what the
 * auth layer already resolves for every other team-scoped model - so this
 * reuses that answer rather than inventing a second notion of which team a
 * caller belongs to.
 */
export function teamMembershipOwnership(field = 'id'): {
  field: string
  resolve: (user: any, req: any) => Promise<number | null>
} {
  return {
    field,
    resolve: async (_user: any, req: any) => {
      try {
        const { resolveAuthenticatedTeamId } = await import('@stacksjs/auth')
        return await resolveAuthenticatedTeamId(teamAuthRequest(req))
      }
      catch {
        return null
      }
    },
  }
}
