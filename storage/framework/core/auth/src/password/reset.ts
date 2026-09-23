import { randomBytes } from 'node:crypto'
import { config } from '@stacksjs/config'
import { db, enqueueAfterCommit, getDatabaseDialect, mutationCount, parseSqlDateTime, sqlDateTime } from '@stacksjs/database/runtime'
import { mail, template } from '@stacksjs/email'
import { log } from '@stacksjs/logging'
import { makeHash, verifyHash } from '@stacksjs/security'
import { authLinkBase } from '../link-url'
import { sessionDestroyAll } from '../session-auth'
import { revokeAllTokens } from '../tokens'

export interface PasswordResetResult {
  success: boolean
  message?: string
}

export interface PasswordResetActions {
  sendEmail: () => Promise<void>
  verifyToken: (token: string) => Promise<boolean>
  resetPassword: (token: string, newPassword: string) => Promise<PasswordResetResult>
}

// Get token expiration from config (default: 60 minutes)
function getTokenExpireMinutes(): number {
  return config.auth.passwordReset?.expire ?? 60
}

/**
 * True when the given password_resets row is still valid. Prefers
 * the explicit `expires_at` column (set at insert time by
 * `createResetToken`) and falls back to clock-arithmetic against
 * `created_at` so rows inserted before the column existed continue
 * to verify correctly (stacksjs/stacks#1861 A-5 + M-2).
 */
function isWithinExpiry(row: Record<string, unknown>): boolean {
  const explicit = row.expires_at
  if (explicit != null)
    return (parseSqlDateTime(explicit)?.getTime() ?? 0) > Date.now()
  const created = parseSqlDateTime(row.created_at)
  const expireMinutes = getTokenExpireMinutes()
  return created != null && Number.isFinite(expireMinutes) && expireMinutes > 0
    && created.getTime() + expireMinutes * 60_000 > Date.now()
}

/**
 * Send a notification email when password has been changed
 * This is a security feature to alert users of password changes
 */
async function sendPasswordChangedNotification(userEmail: string): Promise<void> {
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
    // empty strings instead of throwing (template.ts returns
    // { html: '', text: '' }), which would mail a blank notification with
    // no information. Send a plain-text notification instead.
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
    // Log error but don't throw - the password was already changed successfully
    console.error('[PasswordReset] Failed to send password changed notification:', error)
  }
}

export function passwordResets(email: string): PasswordResetActions {
  function generateResetToken(): string {
    return randomBytes(32).toString('hex')
  }

  async function createResetToken(): Promise<string> {
    const token = generateResetToken()
    const hashedToken = await makeHash(token, { algorithm: 'bcrypt' })
    const expireMinutes = getTokenExpireMinutes()
    const createdAt = new Date()
    const expiresAt = sqlDateTime(new Date(createdAt.getTime() + expireMinutes * 60_000))

    // Delete any existing reset row for this email before inserting
    // the new one so a second reset request invalidates any prior
    // outstanding token. The schema's unique index on `email` enforces
    // single-outstanding-token-per-email at the DB layer; this delete
    // makes the rotation work even when the unique constraint hasn't
    // been applied yet (older installs). See stacksjs/stacks#1861 A-5.
    await db.transaction(async () => {
      await db
        .deleteFrom('password_resets')
        .where('email', '=', email)
        .execute()

      await db
        .insertInto('password_resets')
        .values({
          email,
          token: hashedToken,
          expires_at: expiresAt,
          created_at: sqlDateTime(createdAt),
        } as never)
        .executeTakeFirst()

      const stored = await db.primary.selectFrom('password_resets')
        .where('email', '=', email).selectAll().execute()
      if (stored.length !== 1 || stored[0]?.token !== hashedToken)
        throw new Error('Password reset could not replace its token')
    })

    return token // Return unhashed token for email
  }

  async function sendEmail(): Promise<void> {
    // Anti-enumeration: only proceed for a registered account. An unknown
    // email is a silent no-op — no token row, no send — so the calling
    // action can always return a uniform "if an account exists, we sent a
    // link" response without leaking which addresses are registered.
    // Replica lag must not suppress recovery for a current account or send
    // a reset to an address that no longer belongs to one.
    const user = await db.primary
      .selectFrom('users')
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst()
    if (!user)
      return

    const token = await createResetToken()
    // A caller's outer rollback must not send a link that never committed.
    // Standalone sends still await delivery and surface provider failures.
    const deliver = () => deliverResetEmail(token)
    if (!enqueueAfterCommit(deliver)) await deliver()
  }

  async function deliverResetEmail(token: string): Promise<void> {
    const expireMinutes = getTokenExpireMinutes()
    const appName = config.app.name || 'Stacks'

    // Reset URL. Configurable via `config.auth.passwordReset.url` — a
    // template with `{token}` / `{email}` placeholders — so apps whose
    // reset page lives on a custom route (e.g. `/reset-password?token=…`)
    // can reuse this whole flow instead of hand-rolling the send. Falls
    // back to the framework convention. Absolute templates are used as-is;
    // path templates are prefixed with the app URL.
    const base = authLinkBase()
    const tpl = config.auth.passwordReset?.url
      ?? '/password/reset/{token}?email={email}'
    const filled = tpl.replace('{token}', token).replace('{email}', encodeURIComponent(email))
    const resetUrl = /^https?:\/\//.test(filled) ? filled : `${base}${filled.startsWith('/') ? '' : '/'}${filled}`

    let html: string | undefined
    let text: string | undefined
    try {
      const rendered = await template('password-reset', {
        subject: `Reset Your ${appName} Password`,
        variables: {
          resetUrl,
          expireMinutes,
        },
      })
      html = rendered.html
      text = rendered.text

      // template() swallows missing-template and STX-render failures into
      // empty strings instead of throwing (template.ts returns
      // { html: '', text: '' }), which would mail a blank email with no
      // reset link. Treat an empty render as failure so the plain-text
      // fallback below actually fires — guards against a deleted/broken
      // template (template() now resolves the shipped defaults too,
      // see stacksjs/stacks#1944).
      if (!html && !text)
        throw new Error('password-reset template missing or rendered empty')
    }
    catch (templateError) {
      // Template missing → plain-text fallback so the reset still works
      // without a configured `password-reset` template (mirrors
      // sendVerificationEmail). A hard mail-driver failure still throws.
      const msg = templateError instanceof Error ? templateError.message : String(templateError)
      console.warn(`[PasswordReset] template render failed, sending plain-text fallback: ${msg}`)
      html = undefined
      text = `Reset your password by visiting: ${resetUrl}\n\nThis link expires in ${expireMinutes} minutes. If you didn't request this, you can safely ignore this email.`
    }

    await mail.sendOrFail({
      to: email,
      subject: `Reset Your ${appName} Password`,
      text,
      html,
    })
  }

  async function verifyToken(token: string): Promise<boolean> {
    const result = await db.primary
      .selectFrom('password_resets')
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst()

    if (!result)
      return false

    // Prefer the explicit `expires_at` column when present (it's set
    // at insert time). Fall back to clock-arithmetic against
    // `created_at` for rows inserted before the column existed
    // (stacksjs/stacks#1861 A-5 + M-2).
    if (!isWithinExpiry(result)) {
      await db
        .deleteFrom('password_resets')
        .where('email', '=', email)
        .where('token', '=', result.token)
        .execute()
      return false
    }

    // Verify the hashed token
    const hashedToken = result.token as string
    return await verifyHash(token, hashedToken)
  }

  async function resetPassword(token: string, newPassword: string): Promise<PasswordResetResult> {
    const result = await db.transaction(async (rawTrx) => {
      // The transaction callback receives bun-query-builder's raw `QueryBuilder<DB>`,
      // which marks chained fluent methods like `selectAll` as optional. We mirror
      // the typing of the top-level `db` proxy so chained calls type-check the same way.
      const trx = rawTrx as unknown as typeof db
      // First verify the token exists
      let resetQuery = trx
        .selectFrom('password_resets')
        .where('email', '=', email)
        .selectAll()
      // Lock before the expensive hash checks. SQLite's transaction executor
      // already serializes writers; server databases need an explicit row lock.
      if (getDatabaseDialect() !== 'sqlite') resetQuery = resetQuery.lockForUpdate()
      const resetRecord = await resetQuery.executeTakeFirst()

      // If no reset record, return generic error (don't leak if user exists)
      if (!resetRecord) {
        return { success: false as const, message: 'Invalid or expired reset token' }
      }

      // Check token expiration first (before verifying hash to save compute).
      // Same expires_at-or-created_at logic as `verifyToken` above.
      if (!isWithinExpiry(resetRecord)) {
        await trx
          .deleteFrom('password_resets')
          .where('email', '=', email)
          .execute()

        return { success: false as const, message: 'This password reset link has expired. Please request a new one.' }
      }

      // Verify the hashed token
      const hashedToken = resetRecord.token as string
      const isValid = await verifyHash(token, hashedToken)

      if (!isValid) {
        return { success: false as const, message: 'Invalid or expired reset token' }
      }

      // Update the user's password
      let userQuery = trx
        .selectFrom('users')
        .where('email', '=', email)
        .selectAll()
      if (getDatabaseDialect() !== 'sqlite') userQuery = userQuery.lockForUpdate()
      const user = await userQuery.executeTakeFirst()

      // If no user, return generic error (don't leak user existence)
      if (!user) {
        return { success: false as const, message: 'Invalid or expired reset token' }
      }

      const hashedPassword = await makeHash(newPassword, { algorithm: 'bcrypt' })

      // Hashing and waiting for the owner lock can cross the token's deadline.
      if (!isWithinExpiry(resetRecord))
        return { success: false as const, message: 'Invalid or expired reset token' }

      // SELECT * tells us whether this legacy schema has the optional stamp.
      // Do not discover that with a failed UPDATE: Postgres aborts the entire
      // transaction on a missing column, so retrying in it cannot recover.
      const stamped = Object.hasOwn(user, 'password_changed_at')
      if (!stamped)
        log.warn('[PasswordReset] password_changed_at column missing - run `buddy migrate`; resetting without the credential-version stamp')
      const updated = await trx.updateTable('users')
        .set(stamped ? { password: hashedPassword, password_changed_at: sqlDateTime(new Date()) } as never : { password: hashedPassword })
        .where('id', '=', user.id)
        .execute()
      if (mutationCount(updated) !== 1)
        throw new Error('Password reset could not update its owner')

      // Delete the used reset token
      const consumed = await trx
        .deleteFrom('password_resets')
        .where('email', '=', email)
        .where('token', '=', hashedToken)
        .execute()
      if (mutationCount(consumed) !== 1)
        throw new Error('Password reset token could not be consumed')

      // Credential revocation is database state, not a post-commit side effect.
      // Keep it with the password and consumed reset token so a failed sweep
      // leaves the recovery link usable instead of committing a partial reset.
      // Both helpers follow this active connection and nest using savepoints.
      await revokeAllTokens(Number(user.id))
      await sessionDestroyAll(Number(user.id))

      return { success: true as const }
    })

    // Only the external notification waits until commit.
    if (result.success) {
      // A nested transaction only released its savepoint. Keep the notification
      // with the outer transaction so a later rollback cannot announce a change
      // that never committed. Standalone resets retain non-blocking delivery.
      const notify = () => sendPasswordChangedNotification(email).catch((err) => {
        console.error('[PasswordReset] Failed to send notification:', err)
      })
      if (!enqueueAfterCommit(notify)) void notify()

      return { success: true }
    }

    return result
  }

  return {
    sendEmail,
    verifyToken,
    resetPassword,
  }
}
