import { randomBytes } from 'node:crypto'
import { config, feature, overridesReady } from '@stacksjs/config'
import { db, enqueueAfterCommit, getDatabaseDialect, mutationCount, parseSqlDateTime, sqlDateTime } from '@stacksjs/database/runtime'
import { mail, template } from '@stacksjs/email'
import { log } from '@stacksjs/logging'
import { mountedDefaultRouteBundles } from '@stacksjs/router'
import { makeHash, verifyHash } from '@stacksjs/security'
import { authLinkBase } from '../link-url'
import { findAuthUserRowByEmail, normalizeAuthEmail } from '../credential-user'
import { revokeAccountCredentials, sendPasswordChangedNotification } from './credentials'

export { changePassword, revokeAccountCredentials, sendPasswordChangedNotification } from './credentials'
export type { ChangePasswordOptions, ChangePasswordResult, RevokeAccountCredentialsOptions, RevokeAccountCredentialsResult } from './credentials'

export interface PasswordResetResult {
  success: boolean
  message?: string
}

/**
 * Why the link is being sent. `reset` is "I forgot my password"; `setup` is
 * an account someone else created (an invitation, an import, a staff member
 * adding a client) whose holder chooses their first password. The token and
 * redemption are identical; the default mail differs (`password-setup`
 * template) and a `deliver` hook can tell them apart.
 */
export type PasswordResetPurpose = 'reset' | 'setup'

/** What a `deliver` hook receives. `token` and `url` are the live credential: never log them. */
export interface PasswordResetDelivery {
  purpose: PasswordResetPurpose
  userId: number
  email: string
  token: string
  url: string
  expiresAt: Date
}

export interface SendPasswordResetOptions {
  /** Default `reset`. */
  purpose?: PasswordResetPurpose
  /**
   * When the link stops working. Defaults to now + `config.auth.passwordReset.expire`
   * minutes. A setup link for an invitation can reasonably last days; it is
   * still single use and replaced by the next request.
   */
  expiresAt?: Date
  /**
   * Send it yourself: a localized template, an SMS, a delivery ledger. Runs
   * after the token commits (after the caller's transaction, when there is
   * one), instead of the framework's mail. A throw propagates for a
   * standalone send, exactly as a mail-driver failure does.
   */
  deliver?: (delivery: PasswordResetDelivery) => Promise<void> | void
}

export interface PasswordResetActions {
  /** Issue a link and deliver it. A no-op for an unknown or throttled address (anti-enumeration). */
  sendEmail: (options?: SendPasswordResetOptions) => Promise<void>
  verifyToken: (token: string) => Promise<boolean>
  resetPassword: (token: string, newPassword: string) => Promise<PasswordResetResult>
}

// Get token expiration from config (default: 60 minutes)
function getTokenExpireMinutes(): number {
  return config.auth.passwordReset?.expire ?? 60
}

function getResetThrottleMilliseconds(): number {
  const seconds = config.auth.passwordReset?.throttle ?? 60
  if (seconds === 0)
    return 0
  const milliseconds = seconds * 1000
  return Number.isFinite(milliseconds) && milliseconds > 0 ? milliseconds : 60_000
}

function resetRequestIsThrottled(createdAt: unknown, throttleMs: number): boolean {
  if (throttleMs === 0)
    return false
  const created = parseSqlDateTime(createdAt)
  return created != null && created.getTime() + throttleMs > Date.now()
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

export function passwordResets(value: string): PasswordResetActions {
  const email = normalizeAuthEmail(value)

  function generateResetToken(): string {
    return randomBytes(32).toString('hex')
  }

  async function createResetToken(userId: number, expiresAtOverride?: Date): Promise<{ token: string, expiresAt: Date } | undefined> {
    const throttleMs = getResetThrottleMilliseconds()
    const observed = await db.primary.selectFrom('password_resets')
      .where('email', '=', email).select('created_at')
      .orderBy('created_at', 'desc').executeTakeFirst()
    if (resetRequestIsThrottled(observed?.created_at, throttleMs))
      return undefined

    const token = generateResetToken()
    const hashedToken = await makeHash(token, { algorithm: 'bcrypt' })
    const expireMinutes = getTokenExpireMinutes()

    // Delete any existing reset row for this email before inserting
    // the new one so a second reset request invalidates any prior
    // outstanding token. The schema's unique index on `email` enforces
    // single-outstanding-token-per-email at the DB layer; this delete
    // makes the rotation work even when the unique constraint hasn't
    // been applied yet (older installs). See stacksjs/stacks#1861 A-5.
    const issued = await db.transaction(async () => {
      // Lock a stable owner even when no reset row exists yet. Concurrent
      // replacements otherwise race between DELETE and INSERT on Postgres,
      // including on legacy schemas without the unique email index.
      let ownerQuery = db.primary.selectFrom('users')
        .where('id', '=', userId).select(['id', 'email'])
      if (getDatabaseDialect() !== 'sqlite') ownerQuery = ownerQuery.lockForUpdate()
      const owner = await ownerQuery.executeTakeFirst()
      if (!owner || normalizeAuthEmail(String(owner.email ?? '')) !== email) return false

      const current = await db.primary.selectFrom('password_resets')
        .where('email', '=', email).select('created_at')
        .orderBy('created_at', 'desc').executeTakeFirst()
      if (resetRequestIsThrottled(current?.created_at, throttleMs)) return false

      const createdAt = new Date()
      const expiresAt = sqlDateTime(expiresAtOverride ?? new Date(createdAt.getTime() + expireMinutes * 60_000))
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
        .where('email', '=', email).select(['token']).execute()
      if (stored.length !== 1 || stored[0]?.token !== hashedToken)
        throw new Error('Password reset could not replace its token')
      return true
    // SQLite read-to-write conflicts require retrying the complete claim.
    // Hashing and external delivery are outside that retry boundary.
    }, getDatabaseDialect() === 'sqlite' ? { retries: 3 } : undefined)

    if (!issued) return undefined
    // Return the unhashed token for delivery.
    return { token, expiresAt: expiresAtOverride ?? new Date(Date.now() + expireMinutes * 60_000) }
  }

  async function sendEmail(options: SendPasswordResetOptions = {}): Promise<void> {
    const purpose: PasswordResetPurpose = options.purpose === 'setup' ? 'setup' : 'reset'
    if (options.expiresAt !== undefined && (!(options.expiresAt instanceof Date) || !Number.isFinite(options.expiresAt.getTime()) || options.expiresAt.getTime() <= Date.now()))
      throw new TypeError('[PasswordReset] expiresAt must be a future Date.')

    // Anti-enumeration: only proceed for a registered account. An unknown
    // email is a silent no-op — no token row, no send — so the calling
    // action can always return a uniform "if an account exists, we sent a
    // link" response without leaking which addresses are registered.
    // Replica lag must not suppress recovery for a current account or send
    // a reset to an address that no longer belongs to one.
    const user = await findAuthUserRowByEmail(email)
    if (!user)
      return

    const userId = Number(user.id)
    if (!Number.isSafeInteger(userId) || userId <= 0)
      return
    const issued = await createResetToken(userId, options.expiresAt)
    if (!issued) return
    const delivery: PasswordResetDelivery = {
      purpose,
      userId,
      email,
      token: issued.token,
      url: await resetUrlFor(issued.token),
      expiresAt: issued.expiresAt,
    }
    // A caller's outer rollback must not send a link that never committed.
    // Standalone sends still await delivery and surface provider failures.
    const deliver = options.deliver
      ? async () => { await options.deliver!(delivery) }
      : () => deliverResetEmail(delivery)
    if (!enqueueAfterCommit(deliver)) await deliver()
  }

  async function resetUrlFor(token: string): Promise<string> {
    // Reset URL. Configurable via `config.auth.passwordReset.url` — a
    // template with `{token}` / `{email}` placeholders — so apps whose
    // reset page lives on a custom route (e.g. `/reset-password?token=…`)
    // can reuse this whole flow instead of hand-rolling the send. Falls
    // back to the framework convention. Absolute templates are used as-is;
    // path templates are prefixed with the app URL.
    const base = authLinkBase()
    const tpl = config.auth.passwordReset?.url
      ?? '/password/reset/{token}?email={email}'
    if (!config.auth.passwordReset?.url)
      await warnIfDefaultResetPageMissing()
    const filled = tpl.replace('{token}', token).replace('{email}', encodeURIComponent(email))
    return /^https?:\/\//.test(filled) ? filled : `${base}${filled.startsWith('/') ? '' : '/'}${filled}`
  }

  async function deliverResetEmail(delivery: PasswordResetDelivery): Promise<void> {
    const resetUrl = delivery.url
    const expireMinutes = Math.max(1, Math.round((delivery.expiresAt.getTime() - Date.now()) / 60_000))
    const appName = config.app.name || 'Stacks'
    const setup = delivery.purpose === 'setup'
    const subject = setup ? `Set Your ${appName} Password` : `Reset Your ${appName} Password`

    let html: string | undefined
    let text: string | undefined
    try {
      // One template for both: `purpose` switches its wording for a setup link.
      const rendered = await template('password-reset', {
        subject,
        variables: {
          resetUrl,
          expireMinutes,
          purpose: delivery.purpose,
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
      text = setup
        ? `Choose your password by visiting: ${resetUrl}\n\nThis link expires in ${expireMinutes} minutes.`
        : `Reset your password by visiting: ${resetUrl}\n\nThis link expires in ${expireMinutes} minutes. If you didn't request this, you can safely ignore this email.`
    }

    await mail.sendOrFail({
      to: delivery.email,
      subject,
      text,
      html,
    })
  }

  async function verifyToken(token: string): Promise<boolean> {
    const result = await db.primary
      .selectFrom('password_resets')
      .where('email', '=', email)
      .select(['token', 'expires_at', 'created_at'])
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
    const owner = await findAuthUserRowByEmail(email)
    if (!owner)
      return { success: false, message: 'Invalid or expired reset token' }
    const ownerId = Number(owner.id)
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0)
      return { success: false, message: 'Invalid or expired reset token' }

    const result = await db.transaction(async (rawTrx) => {
      // The transaction callback receives bun-query-builder's raw `QueryBuilder<DB>`,
      // which marks chained fluent methods like `selectAll` as optional. We mirror
      // the typing of the top-level `db` proxy so chained calls type-check the same way.
      const trx = rawTrx as unknown as typeof db
      // Match issuance's owner-then-token order. Reversing it can deadlock a
      // redemption against a concurrent reset request for the same account.
      let userQuery = trx.selectFrom('users').where('id', '=', ownerId).selectAll()
      if (getDatabaseDialect() !== 'sqlite') userQuery = userQuery.lockForUpdate()
      const user = await userQuery.executeTakeFirst()
      if (!user || normalizeAuthEmail(String(user.email ?? '')) !== email)
        return { success: false as const, message: 'Invalid or expired reset token' }

      // First verify the token exists
      let resetQuery = trx
        .selectFrom('password_resets')
        .where('email', '=', email)
        .select(['token', 'expires_at', 'created_at'])
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

      const hashedPassword = await makeHash(newPassword, { algorithm: 'bcrypt' })

      // Hashing and waiting for the owner lock can cross the token's deadline.
      if (!isWithinExpiry(resetRecord))
        return { success: false as const, message: 'Invalid or expired reset token' }

      const updated = await trx.updateTable('users')
        .set({ password: hashedPassword })
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
      // The sweep stamps password_changed_at and joins this transaction.
      await revokeAccountCredentials(Number(user.id))

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

let warnedDefaultResetPage = false

/**
 * The default link lands on the framework's `/password/reset/{token}` page,
 * which posts to the `auth` route bundle's endpoints and is only served where
 * that bundle is mounted. An app that calls this mailer from its
 * own action with the bundle off would otherwise mail links to a 404 with
 * nothing in the logs to say why. Once per process: the answer cannot change
 * without a restart.
 */
async function warnIfDefaultResetPageMissing(): Promise<void> {
  if (warnedDefaultResetPage)
    return
  warnedDefaultResetPage = true
  try {
    await overridesReady
    if (mountedDefaultRouteBundles(feature).has('auth'))
      return
  }
  catch {
    return
  }
  log.warn('[PasswordReset] Reset links point at the default /password/reset/{token} page, which needs the auth route bundle, and it is not mounted (it mounts with the dashboard, or with STACKS_DEFAULT_ROUTES=auth). Set config.auth.passwordReset.url to your own reset page, or mount the bundle.')
}
