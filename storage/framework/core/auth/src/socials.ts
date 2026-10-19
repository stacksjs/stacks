import { config } from '@stacksjs/config'
import { db, sqlDateTime } from '@stacksjs/database/runtime'
import { findAuthUserByEmail } from './credential-user'
import { isEmailVerified } from './email-verification'

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
 * the address (`emailVerified === true`) AND the local account has verified
 * it too (`users.email_verified_at` is set). The second half closes the
 * mirror-image attack: an attacker registers the victim's address locally
 * with a password they know, never verifies it, and waits for the victim's
 * first "Sign in with Google" to link the victim's identity onto an account
 * the attacker can still sign in to. What IS configurable is what happens
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
  | 'unverified-local-email'
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
 * A transaction handle (`db.transaction(async tx => ...)`), threaded through
 * to every store method so the lookup, the user and the link commit together.
 */
export type SocialSignInTransaction = unknown

/**
 * Storage the policy runs against. The default store reads and writes the
 * `social_accounts` and `users` tables; tests inject their own. Every method
 * receives the `tx` passed to {@link resolveSocialSignIn} (undefined when
 * none was).
 */
export interface SocialSignInStore {
  findLink: (provider: string, providerUserId: string, tx?: SocialSignInTransaction) => Promise<{ userId: number } | undefined>
  createLink: (link: { userId: number, provider: string, providerUserId: string, providerEmail: string | null }, tx?: SocialSignInTransaction) => Promise<void>
  findUserIdByEmail: (email: string, tx?: SocialSignInTransaction) => Promise<number | undefined>
  /**
   * Create the local user. `emailVerified` is true when the provider vouched
   * for the address; the default store then stamps `email_verified_at`, since
   * the provider's verification is the same proof a verification email is.
   */
  createUser: (attrs: { name: string, email: string, emailVerified: boolean }, tx?: SocialSignInTransaction) => Promise<number>
  /**
   * Whether the existing local user has verified their address. Optional: a
   * store without it gets the default, which reads `users.email_verified_at`.
   * Return false when unsure; a false refuses the link, never creates.
   */
  isUserEmailVerified?: (userId: number, tx?: SocialSignInTransaction) => Promise<boolean>
}

export interface ResolveSocialSignInOptions {
  /** Run every store call on this transaction. */
  tx?: SocialSignInTransaction
}

type Queryable = typeof db

function on(tx: SocialSignInTransaction | undefined): Queryable {
  return (tx ?? db) as Queryable
}

/** Read `users.email_verified_at` for one user, on `tx` when given. */
export async function isUserEmailVerified(userId: number, tx?: SocialSignInTransaction): Promise<boolean> {
  // The primary when no transaction: a just-verified address must not read as
  // unverified from a lagging replica (that only refuses, but still).
  const source = tx ? on(tx) : (db.primary as unknown as Queryable)
  const row = await source
    .selectFrom('users')
    .select(['email_verified_at'])
    .where('id', '=', userId)
    .executeTakeFirst() as { email_verified_at?: string | Date | null } | undefined
  return row ? isEmailVerified(row) : false
}

/** The store {@link resolveSocialSignIn} uses when none is passed. */
export function defaultSocialSignInStore(): SocialSignInStore {
  return defaultStore()
}

function defaultStore(): SocialSignInStore {
  return {
    async findLink(provider, providerUserId, tx) {
      const row = await on(tx)
        .selectFrom('social_accounts')
        .select(['user_id'])
        .where('provider', '=', provider)
        .where('provider_user_id', '=', providerUserId)
        .executeTakeFirst() as { user_id: number | string } | undefined

      return row ? { userId: Number(row.user_id) } : undefined
    },

    async createLink(link, tx) {
      await on(tx).insertInto('social_accounts').values({
        user_id: link.userId,
        provider: link.provider,
        provider_user_id: link.providerUserId,
        provider_email: link.providerEmail,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      }).execute()
    },

    async findUserIdByEmail(email, tx) {
      if (tx) {
        const row = await on(tx).selectFrom('users').select(['id'])
          .where('email', '=', email).executeTakeFirst() as { id?: number | string } | undefined
        if (row?.id !== undefined)
          return Number(row.id)
      }
      const user = await findAuthUserByEmail(email)
      return user ? Number(user.id) : undefined
    },

    isUserEmailVerified,

    async createUser(attrs, tx) {
      // A social-only user has no password. Store an unusable sentinel rather
      // than an empty string: it can never hash-verify, so the password login
      // path simply fails for this account until the user sets one.
      const { makeHash } = await import('@stacksjs/security')
      const password = await makeHash(crypto.randomUUID(), { algorithm: 'bcrypt' })

      // `User` is a server auto-import global, injected at boot. This package's
      // program does not carry that declaration, so the read is narrowed to
      // what it calls rather than left as `any`, which also unchecked the
      // payload below.
      const verifiedAt = attrs.emailVerified ? sqlDateTime(new Date()) : null
      const injected = globalThis as { User?: { create?: (_data: Record<string, unknown>) => Promise<{ id?: number | string } | undefined> } }
      // The model path fires the model's events; it cannot join a caller's
      // transaction, so a `tx` writes the row directly instead.
      const created = tx ? undefined : await injected.User?.create?.({
        name: attrs.name,
        email: attrs.email,
        password,
      })
      if (created?.id) {
        const id = Number(created.id)
        // email_verified_at is not mass-assignable on the default model, so it
        // is stamped separately rather than dropped by fillable filtering.
        if (verifiedAt)
          await db.updateTable('users').set({ email_verified_at: verifiedAt } as never).where('id', '=', id).execute()
        return id
      }

      // A transaction, or no model global (bare test process): write the row directly.
      const queryable = on(tx)
      await queryable.insertInto('users').values({
        name: attrs.name,
        email: attrs.email,
        password,
        ...(verifiedAt ? { email_verified_at: verifiedAt } : {}),
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      } as never).execute()

      // Drivers disagree on what an insert reports (SQLite and Postgres carry
      // no insertId), and users.email is unique: read the id back by it.
      const inserted = await queryable.selectFrom('users').select(['id'])
        .where('email', '=', attrs.email).executeTakeFirst() as { id?: number | string } | undefined
      const id = Number(inserted?.id ?? 0)
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new Error('[auth/socials] the new user could not be read back after insert.')
      return id
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
  options: ResolveSocialSignInOptions = {},
): Promise<SocialSignInResult> {
  const { tx } = options
  const providerUserId = String(identity.id ?? '').trim()
  if (!provider || !providerUserId)
    throw new TypeError('[auth/socials] a provider name and provider user id are required.')

  // 1. A link row is the durable answer — email drift at the provider never
  //    re-runs the matching logic.
  const existing = await store.findLink(provider, providerUserId, tx)
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
  //    when the provider vouches for the address AND the local account has
  //    verified it. Both guards are deliberately not configurable; see the
  //    module doc for the takeovers they prevent.
  if (matching === 'link' && email) {
    const matchedUserId = await store.findUserIdByEmail(email, tx)
    if (matchedUserId !== undefined) {
      if (identity.emailVerified !== true) {
        throw new SocialSignInRefusedError(
          'unverified-provider-email',
          `${provider} did not verify ${email}, and an account with that address already exists. `
          + `Sign in with your password, then connect ${provider} from your account settings.`,
        )
      }

      const localVerified = await (store.isUserEmailVerified ?? isUserEmailVerified)(matchedUserId, tx)
      if (localVerified !== true) {
        throw new SocialSignInRefusedError(
          'unverified-local-email',
          `An account with ${email} already exists here, but its address has not been verified. `
          + `Sign in with your password and verify your email, then connect ${provider} from your account settings.`,
        )
      }

      await store.createLink({ userId: matchedUserId, provider, providerUserId, providerEmail: email }, tx)
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
  if (matching === 'create' && await store.findUserIdByEmail(email, tx) !== undefined) {
    throw new SocialSignInRefusedError(
      'email-already-registered',
      `An account with ${email} already exists. Sign in with your password, then connect ${provider} from your account settings.`,
    )
  }

  const userId = await store.createUser({ name: displayName, email, emailVerified: identity.emailVerified === true }, tx)
  await store.createLink({ userId, provider, providerUserId, providerEmail: email }, tx)
  return { userId, createdUser: true, linked: true }
}
