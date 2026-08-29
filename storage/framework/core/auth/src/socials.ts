import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'

/**
 * The social sign-in policy: which local user a provider identity resolves to
 * (stacksjs/stacks#2276).
 *
 * `@stacksjs/socials` covers the OAuth exchange and stops at a normalized
 * provider user; `Auth.loginUsingId()` covers session issuance. This is the
 * piece between them — the find-or-create decision every app previously
 * hand-rolled, and the one they usually got wrong in the same way: linking an
 * unverified provider email onto an existing local account, which lets an
 * attacker register a victim's address at any provider that skips email
 * verification and inherit the local account.
 *
 * That takeover guard is therefore NOT configurable: a provider identity only
 * links to an existing user by email when the provider explicitly vouches for
 * the address (`emailVerified === true`). What IS configurable is what happens
 * when no link row exists — `config.auth.socials.matching`:
 *
 * - `'link'` (default): a verified-email match links to the existing user;
 *   no match creates a new user; an unverified match refuses.
 * - `'create'`: never match by email — a first-time provider identity always
 *   becomes a new user. No linking means no takeover surface at all, at the
 *   cost of duplicate accounts for people who registered with a password
 *   first.
 * - `'refuse'`: only identities linked beforehand (from a signed-in session)
 *   may sign in. The strictest posture; social becomes a second factor for
 *   existing accounts rather than an acquisition channel.
 */

/** What the policy needs from a provider profile — @stacksjs/socials' `SocialUser` satisfies this. */
export interface SocialIdentity {
  id: string
  name?: string | null
  nickname?: string | null
  email?: string | null
  /** `true` = provider vouches for the address. `false`/`null`/absent = it does not. */
  emailVerified?: boolean | null
  avatar?: string | null
}

export type SocialMatchingPolicy = 'link' | 'create' | 'refuse'

export type SocialRefusalReason =
  | 'no-linked-account'
  | 'unverified-provider-email'
  | 'no-email-to-create-with'
  | 'email-already-registered'

/** A sign-in the policy declines. `reason` is safe to show a visitor. */
export class SocialSignInRefusedError extends Error {
  readonly reason: SocialRefusalReason

  constructor(reason: SocialRefusalReason, message: string) {
    super(message)
    this.name = 'SocialSignInRefusedError'
    this.reason = reason
  }
}

export interface SocialSignInResult {
  userId: number
  /** True when this call created the local user. */
  createdUser: boolean
  /** True when this call wrote the link row (first sign-in with this identity). */
  linked: boolean
}

/**
 * Storage the policy runs against. The default store reads and writes the
 * `social_accounts` and `users` tables; tests inject their own.
 */
export interface SocialSignInStore {
  findLink: (provider: string, providerUserId: string) => Promise<{ userId: number } | undefined>
  createLink: (link: { userId: number, provider: string, providerUserId: string, providerEmail: string | null }) => Promise<void>
  findUserIdByEmail: (email: string) => Promise<number | undefined>
  createUser: (attrs: { name: string, email: string }) => Promise<number>
}

function defaultStore(): SocialSignInStore {
  return {
    async findLink(provider, providerUserId) {
      const row = await db
        .selectFrom('social_accounts')
        .select(['user_id'])
        .where('provider', '=', provider)
        .where('provider_user_id', '=', providerUserId)
        .executeTakeFirst() as { user_id: number | string } | undefined

      return row ? { userId: Number(row.user_id) } : undefined
    },

    async createLink(link) {
      await db.insertInto('social_accounts').values({
        user_id: link.userId,
        provider: link.provider,
        provider_user_id: link.providerUserId,
        provider_email: link.providerEmail,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      }).execute()
    },

    async findUserIdByEmail(email) {
      const row = await db
        .selectFrom('users')
        .select(['id'])
        .where('email', '=', email)
        .executeTakeFirst() as { id: number | string } | undefined

      return row ? Number(row.id) : undefined
    },

    async createUser(attrs) {
      // A social-only user has no password. Store an unusable sentinel rather
      // than an empty string: it can never hash-verify, so the password login
      // path simply fails for this account until the user sets one.
      const { makeHash } = await import('@stacksjs/security')
      const password = await makeHash(crypto.randomUUID(), { algorithm: 'bcrypt' })

      const created = await (globalThis).User?.create?.({
        name: attrs.name,
        email: attrs.email,
        password,
      })
      if (created?.id)
        return Number(created.id)

      // Model global unavailable (bare test process): write the row directly.
      const row = await db.insertInto('users').values({
        name: attrs.name,
        email: attrs.email,
        password,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      }).executeTakeFirst() as { insertId?: number | bigint } | undefined

      return Number(row?.insertId ?? 0)
    },
  }
}

function configuredMatching(): SocialMatchingPolicy {
  const raw = config.auth?.socials?.matching
  return raw === 'create' || raw === 'refuse' ? raw : 'link'
}

/**
 * Resolve a provider identity to a local user id, creating the user and/or
 * the link row according to the configured matching policy.
 *
 * Throws {@link SocialSignInRefusedError} when the policy says no; every
 * other failure mode (db down, etc.) throws its own error untouched.
 */
export async function resolveSocialSignIn(
  provider: string,
  identity: SocialIdentity,
  store: SocialSignInStore = defaultStore(),
): Promise<SocialSignInResult> {
  const providerUserId = String(identity.id ?? '').trim()
  if (!provider || !providerUserId)
    throw new TypeError('[auth/socials] a provider name and provider user id are required.')

  // 1. A link row is the durable answer — email drift at the provider never
  //    re-runs the matching logic.
  const existing = await store.findLink(provider, providerUserId)
  if (existing)
    return { userId: existing.userId, createdUser: false, linked: false }

  const matching = configuredMatching()
  if (matching === 'refuse') {
    throw new SocialSignInRefusedError(
      'no-linked-account',
      `No ${provider} account is linked here. Sign in with your password, then connect ${provider} from your account settings.`,
    )
  }

  const email = identity.email?.trim().toLowerCase() || null
  const displayName = identity.name?.trim() || identity.nickname?.trim() || (email ?? `${provider} user`)

  // 2. Match an existing local account by email — only under 'link', and only
  //    when the provider vouches for the address. This guard is deliberately
  //    not configurable; see the module doc for the takeover it prevents.
  if (matching === 'link' && email) {
    const matchedUserId = await store.findUserIdByEmail(email)
    if (matchedUserId !== undefined) {
      if (identity.emailVerified !== true) {
        throw new SocialSignInRefusedError(
          'unverified-provider-email',
          `${provider} did not verify ${email}, and an account with that address already exists. `
          + `Sign in with your password, then connect ${provider} from your account settings.`,
        )
      }

      await store.createLink({ userId: matchedUserId, provider, providerUserId, providerEmail: email })
      return { userId: matchedUserId, createdUser: false, linked: true }
    }
  }

  // 3. No matchable account: create one. Requires an email — a User row
  //    without one cannot recover its account or receive anything.
  if (!email) {
    throw new SocialSignInRefusedError(
      'no-email-to-create-with',
      `${provider} shared no email address, so an account cannot be created. `
      + `Grant the email permission at ${provider}, or register with an email first.`,
    )
  }

  // Under 'create' the email was never matched against, but users.email is
  // unique — refuse with a directed message instead of surfacing the
  // constraint violation as a 500.
  if (matching === 'create' && await store.findUserIdByEmail(email) !== undefined) {
    throw new SocialSignInRefusedError(
      'email-already-registered',
      `An account with ${email} already exists. Sign in with your password, then connect ${provider} from your account settings.`,
    )
  }

  const userId = await store.createUser({ name: displayName, email })
  await store.createLink({ userId, provider, providerUserId, providerEmail: email })
  return { userId, createdUser: true, linked: true }
}
