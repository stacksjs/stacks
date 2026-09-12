import { db, getDatabaseDialect, sqlDateTimeLiteral, sqlHelpers } from '@stacksjs/database'

interface TokenIdRow { id: number | string | bigint }

/** Revoke an owner's access/refresh pairs, optionally keeping one session. */
export async function revokeTokenPairs(userId: number, ownerType: string, exceptId?: number): Promise<void> {
  await db.transaction(async (trx) => {
    const sql = sqlHelpers(getDatabaseDialect())
    const processed = new Set<string>()
    const bindings: unknown[] = [userId, ownerType]
    let where = `tokenable_id = ${sql.param(1)} AND tokenable_type = ${sql.param(2)}`
    if (exceptId !== undefined) {
      bindings.push(exceptId)
      where += ` AND id != ${sql.param(bindings.length)}`
    }
    for (;;) {
      // Lock the access rows that refreshToken() locks through its JOIN. Keep
      // already-revoked rows in this scan: a rotation may commit while we wait
      // for its old row. Rescan after locking to see that replacement too.
      // IDs can be allocated before commit, so an id > cursor scan could miss
      // a lower-ID row that becomes visible later. Locks live until commit.
      const rows = await trx.unsafe(`
        SELECT id FROM oauth_access_tokens WHERE ${where}
        ORDER BY id${sql.isSqlite ? '' : ' FOR UPDATE'}
      `, bindings) as unknown as TokenIdRow[]
      const pending = rows.filter(row => !processed.has(String(row.id))).map(row => row.id)
      if (pending.length === 0) break
      // Bound parameter counts independently of the owner's session count.
      for (let offset = 0; offset < pending.length; offset += 100) {
        const ids = pending.slice(offset, offset + 100)
        const placeholders = sql.params(...ids).sql
        await trx.unsafe(`
          UPDATE oauth_refresh_tokens SET revoked = ${sql.boolTrue}
          WHERE access_token_id IN (${placeholders})
        `, ids)
        await trx.unsafe(`
          UPDATE oauth_access_tokens SET revoked = ${sql.boolTrue}, updated_at = ${sqlDateTimeLiteral()}
          WHERE id IN (${placeholders})
        `, ids)
        for (const id of ids) processed.add(String(id))
      }
    }
  }, { retries: 2, sqlStates: ['40001', '40P01'] })
}
