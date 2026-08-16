import { createHash, randomBytes } from 'node:crypto'
import process from 'node:process'
import { config } from '@stacksjs/config'
import { db, sqlDateTime } from '@stacksjs/database'
import { mail, template } from '@stacksjs/email'
import { log } from '@stacksjs/logging'
import { RateLimiter } from './rate-limiter'

/**
 * Magic-link (passwordless) sign-in.
 *
 * Mirrors `password/reset.ts` where the concerns match (anti-enumeration,
 * single outstanding token per email, template-with-plaintext-fallback
 * delivery) and deliberately differs where they don't:
 *
 *   - `token` at rest is SHA-256, not bcrypt: consume is one indexed
 *     lookup, and the raw token carries 256 bits of entropy, so a fast
 *     hash gives an offline attacker nothing.
 *   - Consume is ATOMIC single-use: one conditional UPDATE claims the row;
 *     concurrent requests race for one winner. GET never consumes - the
 *     interstitial page POSTs, because mail scanners prefetch GETs and
 *     would burn single-use links.
 */

export interface SendMagicLinkOptions {
  /** Relative path to land on after login. Absolute URLs are rejected. */
  redirectTo?: string
  /** Multi-site: the site whose host the link should target. */
  siteId?: number
  /** Override `config.auth.magicLink.expire` (minutes). */
  ttlMinutes?: number
  /**
   * Provision a passwordless user when the email is unknown. The
   * parent-portal mode: families sign in by invitation, never register.
   */
  createUser?: boolean
}

export type ConsumeMagicLinkResult
  = | { ok: true, userId: number, email: string, redirectTo: string }
    | { ok: false, reason: 'invalid' | 'expired' | 'used' | 'no-user' }

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

function expireMinutes(): number {
  return config.auth.magicLink?.expire ?? 15
}

function safeRedirect(candidate: string | null | undefined): string {
  const fallback = config.auth.magicLink?.redirectDefault ?? '/'
  if (!candidate)
    return fallback
  // Relative-only: an absolute or protocol-relative value would make the
  // login email an open redirect.
  if (!candidate.startsWith('/') || candidate.startsWith('//'))
    return fallback
  return candidate
}

async function linkBase(siteId: number | undefined): Promise<string> {
  // Multi-site: the link must live on the site's canonical host, because the
  // session cookie the consume sets is host-scoped.
  if (siteId) {
    const primary = await db
      .selectFrom('site_domains')
      .where('site_id', '=', siteId)
      .where('is_primary', '=', true)
      .where('verified_at', 'is not', null)
      .select(['domain'])
      .executeTakeFirst() as { domain: string } | undefined

    if (primary?.domain)
      return `https://${primary.domain}`

    const site = await db
      .selectFrom('sites')
      .where('id', '=', siteId)
      .select(['subdomain'])
      .executeTakeFirst() as { subdomain: string } | undefined

    const base = (config as { sites?: { baseDomain?: string } }).sites?.baseDomain
    if (site?.subdomain && base)
      return `https://${site.subdomain}.${base}`
  }

  return config.app.url ? `https://${config.app.url}` : `http://localhost:${process.env.PORT || '3000'}`
}

/**
 * Issue and send a magic link. ALWAYS resolves void - unknown emails are a
 * silent no-op (unless `createUser`), so callers can answer a uniform
 * "check your email" without leaking which addresses exist. Callers gate
 * with their route's `.rateLimit()`; this adds a per-email limiter on top.
 */
export async function sendMagicLink(email: string, options: SendMagicLinkOptions = {}): Promise<void> {
  const normalized = email.trim().toLowerCase()

  if (await RateLimiter.isRateLimited(normalized))
    return
  await RateLimiter.recordFailedAttempt(normalized)

  let user = await db
    .selectFrom('users')
    .where('email', '=', normalized)
    .select(['id', 'email'])
    .executeTakeFirst() as { id: number, email: string } | undefined

  if (!user && options.createUser) {
    // Passwordless provisioning: a user row with no password. The password
    // column is nullable in the default schema; password logins fail closed
    // for a null hash, so the only way into this account is a fresh link.
    await db
      .insertInto('users')
      .values({
        email: normalized,
        name: normalized.split('@')[0],
        password: null,
        created_at: sqlDateTime(new Date()),
        updated_at: sqlDateTime(new Date()),
      } as never)
      .execute()

    user = await db
      .selectFrom('users')
      .where('email', '=', normalized)
      .select(['id', 'email'])
      .executeTakeFirst() as { id: number, email: string } | undefined
  }

  if (!user)
    return

  const raw = randomBytes(32).toString('base64url')
  const ttl = options.ttlMinutes ?? expireMinutes()
  const redirectTo = safeRedirect(options.redirectTo)

  // One outstanding link per email: a new request invalidates the old link,
  // which also caps the damage window of a leaked inbox.
  await db
    .deleteFrom('magic_link_tokens')
    .where('email', '=', normalized)
    .where('consumed_at', 'is', null)
    .execute()

  await db
    .insertInto('magic_link_tokens')
    .values({
      email: normalized,
      user_id: user.id,
      token: hashToken(raw),
      expires_at: sqlDateTime(new Date(Date.now() + ttl * 60_000)),
      redirect_to: redirectTo,
      site_id: options.siteId ?? null,
      created_at: sqlDateTime(new Date()),
      updated_at: sqlDateTime(new Date()),
    } as never)
    .execute()

  const base = await linkBase(options.siteId)
  const tpl = config.auth.magicLink?.url ?? '/auth/magic/{token}'
  const filled = tpl.replace('{token}', raw)
  const linkUrl = /^https?:\/\//.test(filled) ? filled : `${base}${filled.startsWith('/') ? '' : '/'}${filled}`

  const appName = config.app.name || 'Stacks'
  let html: string | undefined
  let text: string | undefined
  try {
    const rendered = await template('magic-link', {
      subject: `Sign in to ${appName}`,
      variables: { linkUrl, expireMinutes: ttl },
    })
    // template() swallows failures into empty strings; treat that as a miss
    // so the plain-text path below still carries the link.
    if (rendered.html || rendered.text) {
      html = rendered.html
      text = rendered.text
    }
  }
  catch {
    // Fall through to plain text.
  }

  try {
    await mail.sendOrFail({
      to: normalized,
      subject: `Sign in to ${appName}`,
      ...(html ? { html } : {}),
      text: text || `Sign in to ${appName}: ${linkUrl}\n\nThis link works once and expires in ${ttl} minutes. If you didn't request it, ignore this email.`,
    })
  }
  catch (error) {
    log.error(`Magic-link email to ${normalized} failed: ${(error as Error).message}`)
  }
}

/**
 * Atomically consume a raw token. Exactly one caller can win a given token:
 * the claim is a conditional UPDATE on (unconsumed AND unexpired), so two
 * concurrent consumes resolve to one `ok` and one `used`.
 */
export async function consumeMagicLink(raw: string): Promise<ConsumeMagicLinkResult> {
  if (!raw || raw.length > 255)
    return { ok: false, reason: 'invalid' }

  const hashed = hashToken(raw)
  const now = sqlDateTime(new Date())

  const claim = await db
    .updateTable('magic_link_tokens')
    .set({ consumed_at: now, updated_at: now })
    .where('token', '=', hashed)
    .where('consumed_at', 'is', null)
    .where('expires_at', '>', now)
    .execute() as unknown

  // bun-query-builder returns the affected-row count as a bare number on
  // SQLite; other drivers report an object. Treat anything ambiguous as 0 -
  // an unclaimed token must never log someone in.
  const updated = typeof claim === 'number'
    ? claim
    : Number((claim as { numUpdatedRows?: bigint | number })?.numUpdatedRows
      ?? (claim as { changes?: number })?.changes ?? 0)

  const row = await db
    .selectFrom('magic_link_tokens')
    .where('token', '=', hashed)
    .select(['user_id', 'email', 'expires_at', 'consumed_at', 'redirect_to'])
    .executeTakeFirst() as {
    user_id: number | null
    email: string
    expires_at: string
    consumed_at: string | null
    redirect_to: string | null
  } | undefined

  if (!row)
    return { ok: false, reason: 'invalid' }

  if (updated < 1) {
    // The claim missed: someone got here first, or it expired unconsumed.
    if (!row.consumed_at && new Date(row.expires_at).getTime() <= Date.now())
      return { ok: false, reason: 'expired' }
    return { ok: false, reason: 'used' }
  }

  if (!row.user_id)
    return { ok: false, reason: 'no-user' }

  return {
    ok: true,
    userId: Number(row.user_id),
    email: row.email,
    redirectTo: safeRedirect(row.redirect_to),
  }
}

/** Drop expired and long-consumed rows. For a daily janitor job. */
export async function pruneMagicLinkTokens(olderThanDays = 7): Promise<void> {
  const cutoff = sqlDateTime(new Date(Date.now() - olderThanDays * 86_400_000))
  await db
    .deleteFrom('magic_link_tokens')
    .where('expires_at', '<', cutoff)
    .execute()
}
