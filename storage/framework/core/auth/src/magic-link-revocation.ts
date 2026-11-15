import { db, tableExists } from '@stacksjs/database/runtime'

/** Revoke outstanding passwordless grants as part of account recovery. */
export async function revokeMagicLinks(userId: number): Promise<void> {
  // An app that never enabled magic links has no table and nothing to revoke.
  // Asking the catalog keeps every password change from logging a failed
  // DELETE as an error, which an error tracker then files as an issue.
  if (!(await tableExists('magic_link_tokens'))) return
  try {
    // A savepoint keeps an absent optional table from aborting PostgreSQL's
    // enclosing recovery transaction. Other storage failures must propagate.
    await db.transaction(async () => {
      await db.deleteFrom('magic_link_tokens').where('user_id', '=', userId).whereNull('consumed_at').execute()
      const remaining = await db.primary.selectFrom('magic_link_tokens')
        .where('user_id', '=', userId).whereNull('consumed_at').select('id').executeTakeFirst()
      if (remaining) throw new Error('[auth] Magic-link credentials could not be revoked.')
    })
  }
  catch (error) {
    // Bun's SQL driver can reject with a plain error record, not an Error
    // instance. Keep the exact table match below for both representations.
    const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message : String(error)
    if (/^(?:no such table: (?:main\.)?magic_link_tokens|relation "magic_link_tokens" does not exist|Table '(?:[^'.]+\.)?magic_link_tokens' doesn't exist)$/i.test(message))
      return
    throw error
  }
}
