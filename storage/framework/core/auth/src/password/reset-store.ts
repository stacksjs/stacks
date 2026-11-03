import { db, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'
import { normalizeAuthEmail } from '../credential-user'

function ownerAddress(email: string) {
  const sql = sqlHelpers(getDatabaseDialect())
  return { where: `LOWER(email) = ${sql.param(1)}`, parameters: [normalizeAuthEmail(email)] }
}

/** Internal: the caller holds the account lock in the active transaction. */
export async function pendingPasswordResetCredentials(email: string): Promise<Array<{ email: string, created_at: unknown }>> {
  const owner = ownerAddress(email)
  return await db.primary.unsafe(`SELECT email, created_at FROM password_resets WHERE ${owner.where}`, owner.parameters) as Array<{ email: string, created_at: unknown }>
}

/** Retire canonical and supported legacy case variants, verifying the write. */
export async function deletePasswordResetCredentials(email: string): Promise<void> {
  const owner = ownerAddress(email)
  await db.unsafe(`DELETE FROM password_resets WHERE ${owner.where}`, owner.parameters)
  const remaining = await db.primary.unsafe(`SELECT email FROM password_resets WHERE ${owner.where} LIMIT 1`, owner.parameters) as Array<{ email: string }>
  if (remaining.length) throw new Error('Password reset credentials could not be removed')
}
