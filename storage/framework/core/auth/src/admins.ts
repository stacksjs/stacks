/**
 * Administrators named in configuration (`config.auth.admins`).
 *
 * An application's operators are usually a short list of email addresses
 * that every environment needs: a fresh install, a client's own deployment,
 * a staging database restored from nothing. Instead of seeding them by hand
 * or shipping passwords, list the addresses and run `./buddy seed:admins`,
 * which is safe on every deploy:
 *
 *   - an address with no account gets one: a verified email and a random
 *     password nobody knows, so its first sign-in is a password reset or a
 *     social sign-in that links the verified address (`auth.socials`);
 *   - every listed account holds `config.auth.adminRole` (`admin` on `web`
 *     by default), created if the role row is missing.
 *
 * Grants only. Removing an address from the list never revokes anything:
 * a deploy that read a truncated list must not lock its operators out.
 *
 * Applications with authority of their own (an organization membership, a
 * team seat) pass `afterEach`, and `createUser` when an account needs more
 * than a users row; `role: false` skips the RBAC grant entirely.
 */

import { randomBytes } from 'node:crypto'
import { config } from '@stacksjs/config'
import { db, sqlDateTime } from '@stacksjs/database/runtime'
import { makeHash } from '@stacksjs/security'
import { findAuthUserRowByEmail, normalizeAuthEmail } from './credential-user'
import { assignRole, createRole, findRole, hasFreshRole } from './rbac'

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/

export interface AdminRole { name: string, guard?: string }

/**
 * The configured addresses, normalized. Throws on a malformed or repeated
 * address so a typo fails the deploy rather than granting nothing.
 */
export function adminEmails(list: unknown = config.auth?.admins): string[] {
  if (list === undefined || list === null) return []
  if (!Array.isArray(list)) throw new TypeError('auth.admins must be a list of email addresses')
  const emails = list.map(value => normalizeAuthEmail(String(value ?? '')))
  const invalid = emails.find(email => email.length > 254 || !EMAIL.test(email))
  if (invalid !== undefined) throw new TypeError(`auth.admins lists an invalid email address: "${invalid}"`)
  const repeated = emails.find((email, index) => emails.indexOf(email) !== index)
  if (repeated) throw new TypeError(`auth.admins lists ${repeated} twice`)
  return emails
}

/** "ada.lovelace@…" → "Ada Lovelace": a name until the person (or their identity provider) sets one. */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0]!.replace(/\+.*$/, '')
  const words = local.split(/[._-]+/).filter(Boolean)
  return words.length ? words.map(word => word[0]!.toUpperCase() + word.slice(1)).join(' ') : email
}

/** The accounts side, swappable for tests and for applications whose users carry more than a row. */
export interface AdminAccountStore {
  findUserId: (email: string) => Promise<number | null>
  createUser: (account: { email: string, name: string }) => Promise<number>
}

export const databaseAdminAccounts: AdminAccountStore = {
  async findUserId(email) {
    const row = await findAuthUserRowByEmail(email)
    return row ? Number(row.id) : null
  },
  async createUser({ email, name }) {
    const now = sqlDateTime()
    await db.insertInto('users').values({
      email, name, email_verified_at: now, created_at: now, updated_at: now,
      password: await makeHash(randomBytes(32).toString('hex'), { algorithm: 'bcrypt' }),
    }).execute()
    const row = await findAuthUserRowByEmail(email)
    if (!row) throw new Error(`Could not read back the account created for ${email}`)
    return Number(row.id)
  },
}

export interface ProvisionAdminsOptions {
  /** Defaults to `config.auth.admins`. */
  emails?: readonly string[]
  /** Defaults to `config.auth.adminRole`, else `admin` on `web`. `false`: no RBAC grant. */
  role?: AdminRole | false
  accounts?: Partial<AdminAccountStore>
  /** The application's own authority for each account, after its role. */
  afterEach?: (admin: { userId: number, email: string, created: boolean }) => Promise<boolean | void>
}

export interface ProvisionedAdmin {
  email: string
  userId: number
  /** `created`: a new account. `granted`: an existing one gained the role (or `afterEach` reported a change). */
  outcome: 'created' | 'granted' | 'unchanged'
}

/** Make every configured address an administrator. Idempotent: a second run reports each one `unchanged`. */
export async function provisionAdmins(options: ProvisionAdminsOptions = {}): Promise<ProvisionedAdmin[]> {
  const emails = adminEmails(options.emails ?? config.auth?.admins)
  const configured = options.role ?? config.auth?.adminRole ?? { name: 'admin', guard: 'web' }
  const role = configured === false ? null : { name: configured.name, guard: configured.guard ?? 'web' }
  const accounts = { ...databaseAdminAccounts, ...options.accounts }
  if (role && emails.length && !await findRole(role.name, role.guard))
    await createRole(role.name, role.guard, 'Administrators named in config.auth.admins')

  const results: ProvisionedAdmin[] = []
  for (const email of emails) {
    const existing = await accounts.findUserId(email)
    const userId = existing ?? await accounts.createUser({ email, name: nameFromEmail(email) })
    let changed = false
    if (role && !await hasFreshRole(userId, role.name, role.guard)) {
      await assignRole(userId, role.name, role.guard)
      changed = true
    }
    if (options.afterEach && await options.afterEach({ userId, email, created: existing === null }) === true)
      changed = true
    results.push({ email, userId, outcome: existing === null ? 'created' : changed ? 'granted' : 'unchanged' })
  }
  return results
}
