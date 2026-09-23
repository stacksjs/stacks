import { db, getDatabaseDialect } from '@stacksjs/database/runtime'

/**
 * Bind credential issuance to the password version actually verified.
 * Bcrypt runs before this short critical section. A completed password reset
 * or account deletion must not be followed by an old in-flight login issuing
 * a new credential after the reset's revocation sweep.
 */
export async function withVerifiedPassword<T>(
  userId: number | string,
  verifiedHash: unknown,
  issue: () => Promise<T>,
): Promise<T | null> {
  if (typeof verifiedHash !== 'string' || verifiedHash.length === 0) return null
  return db.transaction(async () => {
    let query = db.primary.selectFrom('users').where('id', '=', userId).select(['id', 'password'])
    if (getDatabaseDialect() !== 'sqlite') query = query.lockForUpdate()
    const current = await query.executeTakeFirst()
    if (!current || current.password !== verifiedHash) return null
    return issue()
  })
}
