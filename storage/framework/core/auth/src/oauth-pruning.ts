import {
  db,
  getDatabaseDialect,
  markContextWrote,
  mutationCount,
  sqlDateTime,
  sqlHelpers,
} from '@stacksjs/database/runtime'

export interface OAuthAuthorizationPruneOptions {
  now?: Date
  consumedRetentionMs?: number
}

export interface OAuthAuthorizationPruneResult {
  authorizationRequests: number
  authorizationCodes: number
}

/** Delete expired OAuth browser requests and codes without touching active rows. */
export async function pruneOAuthAuthorizationArtifacts(
  options: OAuthAuthorizationPruneOptions = {},
): Promise<OAuthAuthorizationPruneResult> {
  const now = options.now ?? new Date()
  const consumedRetentionMs = options.consumedRetentionMs ?? 7 * 24 * 60 * 60 * 1000
  if (!Number.isFinite(now.getTime()))
    throw new TypeError('OAuth authorization prune time must be a valid date.')
  if (!Number.isFinite(consumedRetentionMs) || consumedRetentionMs < 0)
    throw new TypeError('OAuth authorization consumed retention must be a non-negative number of milliseconds.')

  const sql = sqlHelpers(getDatabaseDialect())
  const nowSql = sqlDateTime(now)
  const consumedBefore = sqlDateTime(new Date(now.getTime() - consumedRetentionMs))
  const result = await db.transaction(async (rawTrx) => {
    const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
    const requests = await trx.unsafe(`
      DELETE FROM oauth_authorization_requests
      WHERE expires_at <= ${sql.param(1)}
        OR (consumed_at IS NOT NULL AND consumed_at <= ${sql.param(2)})
    `, [nowSql, consumedBefore])
    const codes = await trx.unsafe(`
      DELETE FROM oauth_auth_codes
      WHERE expires_at <= ${sql.param(1)}
        OR (consumed_at IS NOT NULL AND consumed_at <= ${sql.param(2)})
    `, [nowSql, consumedBefore])
    return {
      authorizationRequests: mutationCount(requests),
      authorizationCodes: mutationCount(codes),
    }
  })

  if (result.authorizationRequests > 0 || result.authorizationCodes > 0)
    markContextWrote()
  return result
}
