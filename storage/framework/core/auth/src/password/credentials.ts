import { config } from '@stacksjs/config'
import { db, enqueueAfterCommit, getDatabaseDialect, isInTransaction, mutationCount, parseSqlDateTime, sqlDateTime } from '@stacksjs/database/runtime'
import { mail, template } from '@stacksjs/email'
import { log } from '@stacksjs/logging'
import { makeHash, verifyHash } from '@stacksjs/security'
import { withVerifiedPassword } from '../credential-version'
import { revokeMagicLinks } from '../magic-link-revocation'
import { revokeOAuthSubjectAuthorizationState } from '../oauth-grants'
import { sessionDestroyAll } from '../session-auth'
import { revokeTokenPairs } from '../token-revocation'
import { DEFAULT_TOKENABLE_TYPE } from '../tokens'
import { revokeTwoFactorChallenges } from '../two-factor'

/**
 * One credential sweep for every path that changes how an account proves who
 * it is: a password reset, a password change, an account recovery, an admin
 * forcing a sign-out.
 *
 * Password resets swept everything; anything else that changed a password
 * had to remember the same five revocations and the stamp, and an app that
 * forgot one left a door open (an attacker's session surviving the victim's
 * password change is the case that matters). This is that sweep, exported:
 *
 * - stamps `users.password_changed_at`, which the token paths read to refuse
 *   any token issued before it, so even a token this sweep could not see is
 *   dead;
 * - revokes pending two-factor login challenges, magic links, OAuth grants
 *   and authorization codes, access and refresh tokens, and sessions;
 * - all in one transaction: a failure anywhere rolls the whole sweep back
 *   rather than reporting a half-revoked account.
 *
 * `exceptTokenId` / `exceptSessionId` keep the caller's own credential, so a
 * user who changes their password stays signed in where they did it. The kept
 * token (and its refresh token) is re-bound to the new stamp; everything else
 * the account holds is gone.
 */

export interface RevokeAccountCredentialsOptions {
  /** An access token to keep (the caller's own). Every other token is revoked. */
  exceptTokenId?: number
  /** A `sessions` row to keep (the caller's own cookie session). */
  exceptSessionId?: string
  /**
   * The caller's active transaction. The sweep joins it (as a savepoint), so
   * it commits or rolls back with the caller's own writes. The framework's
   * query builder follows the active transaction implicitly; passing it here
   * documents the intent and is checked.
   */
  tx?: unknown
}

export interface RevokeAccountCredentialsResult {
  /** The stamp written, or null on a legacy schema without the column. */
  passwordChangedAt: Date | null
  /** The token that survived, when one was kept. */
  keptTokenId: number | null
}


export async function revokeAccountCredentials(userId: number, options: RevokeAccountCredentialsOptions = {}): Promise<RevokeAccountCredentialsResult> {
  if (!Number.isSafeInteger(userId) || userId <= 0)
    throw new TypeError('[auth] revokeAccountCredentials needs a positive integer user id.')
  if (options.exceptTokenId !== undefined && (!Number.isSafeInteger(options.exceptTokenId) || options.exceptTokenId <= 0))
    throw new TypeError('[auth] exceptTokenId must be a positive integer.')
  // A tx handed over outside its own callback would make the sweep commit on
  // its own while the caller believes it is part of their transaction.
  if (options.tx !== undefined && !isInTransaction())
    throw new TypeError('[auth] revokeAccountCredentials was given a tx but is not running inside that transaction.')

  return db.transaction(async () => {
    // SELECT * tells us whether this legacy schema has the optional stamp.
    // Do not discover that with a failed UPDATE: Postgres aborts the whole
    // transaction on a missing column, so nothing after it could recover.
    let ownerQuery = db.primary.selectFrom('users').where('id', '=', userId).selectAll()
    if (getDatabaseDialect() !== 'sqlite') ownerQuery = ownerQuery.lockForUpdate()
    const owner = await ownerQuery.executeTakeFirst() as Record<string, unknown> | undefined
    if (!owner)
      throw new Error('[auth] revokeAccountCredentials: the user does not exist.')

    let passwordChangedAt: Date | null = null
    const stampValue = sqlDateTime(new Date())
    if (Object.hasOwn(owner, 'password_changed_at')) {
      const stamped = await db.updateTable('users')
        .set({ password_changed_at: stampValue } as never)
        .where('id', '=', userId)
        .execute()
      if (mutationCount(stamped) !== 1)
        throw new Error('[auth] revokeAccountCredentials could not stamp password_changed_at.')
      passwordChangedAt = parseSqlDateTime(stampValue)
    }
    else {
      log.warn('[auth] password_changed_at column missing - run `buddy migrate`; credentials are revoked without the credential-version stamp')
    }

    // These helpers follow the active connection and nest using savepoints.
    await revokeTwoFactorChallenges(userId)
    await revokeMagicLinks(userId)
    await revokeOAuthSubjectAuthorizationState('users', userId)
    await revokeTokenPairs(userId, DEFAULT_TOKENABLE_TYPE, options.exceptTokenId)
    await sessionDestroyAll(userId, options.exceptSessionId !== undefined ? { exceptId: options.exceptSessionId } : {})

    let keptTokenId: number | null = null
    if (options.exceptTokenId !== undefined && passwordChangedAt) {
      // The stamp refuses every token created before it, the kept one too.
      // Re-bind it (and its live refresh tokens) to the stamp so it is the
      // one credential issued "after" the change.
      const rebound = await db.updateTable('oauth_access_tokens')
        .set({ created_at: stampValue } as never)
        .where('id', '=', options.exceptTokenId)
        .where('tokenable_id', '=', userId)
        .execute()
      if (mutationCount(rebound) === 1) {
        await db.updateTable('oauth_refresh_tokens')
          .set({ created_at: stampValue } as never)
          .where('access_token_id', '=', options.exceptTokenId)
          .execute()
        keptTokenId = options.exceptTokenId
      }
    }
    else if (options.exceptTokenId !== undefined) {
      keptTokenId = options.exceptTokenId
    }

    return { passwordChangedAt, keptTokenId }
  })
}

export interface ChangePasswordOptions {
  /** The caller's access token, kept signed in. Omit to sign out everywhere. */
  keepTokenId?: number
  /** The caller's cookie session, kept signed in. */
  keepSessionId?: string
  /**
   * After commit, tell the account holder. `true` (default) sends the
   * framework's `password-changed` mail; a function replaces it (localized
   * templates, an SMS, a delivery ledger); `false` sends nothing.
   */
  notify?: boolean | ((user: { id: number, email: string, name?: string }) => Promise<void> | void)
}

export type ChangePasswordResult =
  | { success: true, keptTokenId: number | null }
  | { success: false, reason: 'invalid-current-password' | 'user-not-found' | 'invalid-new-password' }

/**
 * Change a password the signed-in user knows, then sweep every other
 * credential the account holds.
 *
 * The current password is verified, and the change commits only if it is
 * still the stored hash at write time (a concurrent reset or change wins, and
 * this returns `invalid-current-password`). The new password's policy (length,
 * strength, breach checks) is the caller's to enforce first.
 */
export async function changePassword(userId: number, currentPassword: string, newPassword: string, options: ChangePasswordOptions = {}): Promise<ChangePasswordResult> {
  if (typeof newPassword !== 'string' || newPassword.length === 0)
    return { success: false, reason: 'invalid-new-password' }

  const user = await db.primary.selectFrom('users').where('id', '=', userId)
    .select(['id', 'email', 'name', 'password']).executeTakeFirst() as { id: number, email?: string, name?: string, password?: string } | undefined
  if (!user)
    return { success: false, reason: 'user-not-found' }

  const storedHash = typeof user.password === 'string' ? user.password : ''
  if (typeof currentPassword !== 'string' || !storedHash || !await verifyHash(currentPassword, storedHash))
    return { success: false, reason: 'invalid-current-password' }

  // Hash outside the locked section; bcrypt is the slow part.
  const hashed = await makeHash(newPassword, { algorithm: 'bcrypt' })

  const swept = await withVerifiedPassword(userId, storedHash, async () => {
    const updated = await db.updateTable('users').set({ password: hashed } as never).where('id', '=', userId).execute()
    if (mutationCount(updated) !== 1)
      throw new Error('[auth] changePassword could not update the password.')
    return revokeAccountCredentials(userId, {
      ...(options.keepTokenId !== undefined && { exceptTokenId: options.keepTokenId }),
      ...(options.keepSessionId !== undefined && { exceptSessionId: options.keepSessionId }),
    })
  })
  if (!swept)
    return { success: false, reason: 'invalid-current-password' }

  const notify = options.notify ?? true
  if (notify !== false && user.email) {
    const recipient = { id: Number(user.id), email: String(user.email), ...(user.name ? { name: String(user.name) } : {}) }
    const send = async () => {
      try {
        if (typeof notify === 'function') await notify(recipient)
        else await sendPasswordChangedNotification(recipient.email)
      }
      catch (error) {
        log.error(`[auth] password-changed notification failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    // A caller's outer rollback must not announce a change that never committed.
    if (!enqueueAfterCommit(send)) void send()
  }

  return { success: true, keptTokenId: swept.keptTokenId }
}

/**
 * The framework's "your password was changed" mail. Never throws: the change
 * already happened, and a mail failure must not report it as failed.
 */
export async function sendPasswordChangedNotification(userEmail: string): Promise<void> {
  const appName = config.app.name || 'Stacks'
  const supportEmail = config.app.supportEmail || config.email?.from?.address || ''
  const changedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  })

  try {
    const { html, text } = await template('password-changed', {
      subject: `Your ${appName} password has been changed`,
      variables: {
        changedAt,
        supportEmail,
      },
    })

    // template() swallows missing-template and STX-render failures into
    // empty strings instead of throwing, which would mail a blank
    // notification. Send a plain-text notification instead.
    if (!html && !text) {
      await mail.sendOrFail({
        to: userEmail,
        subject: `Your ${appName} password has been changed`,
        text: `Your ${appName} password was changed on ${changedAt}.${supportEmail ? ` If this wasn't you, contact ${supportEmail}.` : ''}`,
      })
      return
    }

    await mail.sendOrFail({
      to: userEmail,
      subject: `Your ${appName} password has been changed`,
      text,
      html,
    })
  }
  catch (error) {
    console.error('[PasswordReset] Failed to send password changed notification:', error)
  }
}
