/**
 * Adding a user from the dashboard, by invitation.
 *
 * An account's password is its holder's to choose, so an operator cannot type
 * a new user in: the form has no password to give, and one typed by somebody
 * else would have to travel to the person some other way. Instead the account
 * is created with a password nobody knows and the person is mailed a link to
 * choose their own, the framework's account-setup link
 * (`passwordResets().sendEmail({ purpose: 'setup' })`).
 *
 * An invitation that was not delivered leaves no account behind. Otherwise a
 * mail outage would fill the Users page with accounts whose holders were
 * never told they exist, and the operator's retry would be refused as a
 * duplicate.
 */
import { randomBytes } from 'node:crypto'
import { isUniqueViolation, ModelValidationError, toSnakeCaseKeys } from '@stacksjs/orm'
import { prepareModelFields } from '../Models/model-write'

/** How long the link in the invitation works. Long enough to survive a weekend. */
export const USER_INVITATION_DAYS = 7

const DAY_MS = 86_400_000

export interface InviteUserInput {
  name?: unknown
  email?: unknown
}

export interface InviteUserDependencies {
  /** The `User` model: validates, hashes the password and writes the row. */
  Model: any
  /** The account that already holds this address, when there is one. */
  findUserByEmail: (email: string) => Promise<unknown>
  /**
   * Remove setup and reset links left for this address. It has no account at
   * this point, so any that exist belong to an account that is gone: left
   * alone, one would throttle this invitation, or open the new account to
   * whoever still holds the old mail.
   */
  clearSetupLinks: (email: string) => Promise<void>
  /** Mail the link. False when none was sent; throws when the mailer does. */
  sendSetupLink: (email: string, expiresAt: Date) => Promise<boolean>
  now?: () => Date
}

export type InviteUserResult
  = | { ok: true, id: number | string, email: string, expiresAt: Date }
    | { ok: false, reason: 'invalid', errors: Record<string, string[]> }
    | { ok: false, reason: 'undelivered' | 'stranded' | 'failed', cause: unknown }

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const TAKEN = 'A user with this email already exists.'

export async function inviteUser(input: InviteUserInput, dependencies: InviteUserDependencies): Promise<InviteUserResult> {
  const { Model } = dependencies
  const email = normalizeEmail(input.email)
  const name = typeof input.name === 'string' ? input.name.trim() : input.name
  const { data, errors } = prepareModelFields(Model, { name, email })
  if (Object.keys(errors).length > 0)
    return { ok: false, reason: 'invalid', errors }

  if (await dependencies.findUserByEmail(email))
    return { ok: false, reason: 'invalid', errors: { email: [TAKEN] } }

  let id: number | string
  try {
    await dependencies.clearSetupLinks(email)
    // Never shown, mailed or logged: it only has to satisfy the column until
    // the person replaces it. The model hashes it like any other password.
    const password = randomBytes(24).toString('base64url')
    const row = await Model.create({ ...toSnakeCaseKeys(data), password })
    id = row?.id ?? row?.attributes?.id
    if (id === undefined || id === null)
      throw new Error('The created user came back without an id.')
  }
  catch (error) {
    if (error instanceof ModelValidationError)
      return { ok: false, reason: 'invalid', errors: error.errors }
    // Two operators inviting one address at once: the second loses here.
    if (isUniqueViolation(error))
      return { ok: false, reason: 'invalid', errors: { email: [TAKEN] } }
    return { ok: false, reason: 'failed', cause: error }
  }

  const now = dependencies.now?.() ?? new Date()
  const expiresAt = new Date(now.getTime() + USER_INVITATION_DAYS * DAY_MS)
  let cause: unknown = new Error('No setup link was issued for the new account.')
  try {
    if (await dependencies.sendSetupLink(email, expiresAt))
      return { ok: true, id, email, expiresAt }
  }
  catch (error) {
    cause = error
  }

  try {
    const row = await Model.find(id)
    await row?.delete()
    await dependencies.clearSetupLinks(email)
  }
  catch (error) {
    // The account exists and its holder was never told. Say exactly that.
    return { ok: false, reason: 'stranded', cause: new AggregateError([cause, error], 'The invitation was not delivered and its account could not be removed.') }
  }
  return { ok: false, reason: 'undelivered', cause }
}
