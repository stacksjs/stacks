/**
 * The yes-or-no facts a trait keeps about a record for itself, offered on the
 * record's edit form as switches (stacksjs/stacks#3298).
 *
 * A model's form asks for the model's own fillable attributes. Whether an
 * account's email is confirmed and whether it signs in with two-factor are
 * not attributes: the `useAuth` trait owns those columns, and changing one
 * is more than writing it. Turning two-factor off removes the secret, the
 * recovery codes and any open challenge. So each switch names the function
 * that changes it, and the form's save calls that function instead of
 * writing the column.
 *
 * Derived from the trait, not declared by the model. Only the model the auth
 * package writes (`User`, on `users`) has any.
 */
import type { ModelCreateField } from './model-write'
import { db } from '@stacksjs/database/runtime'
import { isAccountModel, modelColumnLabel } from './model-write'

export interface ModelSwitch {
  /** The field, as a form names it: `emailVerifiedAt`. */
  name: string
  /** Where its state is read from: `email_verified_at`. Set when not null, not false and not zero. */
  column: string
  /** The sentence under the switch. */
  help: string
  /** The one way it can be turned from here, when it has only one. */
  only?: 'off' | 'on'
  /** The sentence under it while it cannot be turned. */
  lockedHelp?: string
  /** What changes it. Never a bare write of the column. */
  set: (id: number, on: boolean) => Promise<void>
}

const ACCOUNT_SWITCHES: ModelSwitch[] = [
  {
    name: 'emailVerifiedAt',
    column: 'email_verified_at',
    help: 'On, this address counts as confirmed, as if they had used the emailed link. Off, it does not.',
    async set(id, on) {
      const { setEmailVerified } = await import('@stacksjs/auth')
      await setEmailVerified(id, on)
    },
  },
  {
    name: 'twoFactorEnabled',
    column: 'two_factor_enabled',
    only: 'off',
    help: 'Turn off for someone who lost their device. Their authenticator and recovery codes stop working, and they can set two-factor up again from their own account.',
    lockedHelp: 'Only the account holder can turn this on, by setting up an authenticator from their own account.',
    async set(id) {
      const { disableTwoFactor } = await import('@stacksjs/auth')
      await disableTwoFactor(id)
    },
  },
]

/** The switches a model's edit form has beside its own fields. */
export function modelSwitches(Model: any): ModelSwitch[] {
  // The auth package writes `users`, as the invitation does, so this is
  // `User` and not every model with `useAuth`.
  return Model?.name === 'User' && isAccountModel(Model) ? ACCOUNT_SWITCHES : []
}

/** Whether a stored value reads as yes: a moment that is set, a true, a one. */
export function modelSwitchOn(stored: unknown): boolean {
  return !(stored === null || stored === undefined || stored === false || stored === 0 || stored === '' || stored === '0' || stored === 'false')
}

/** The switches as fields of the edit form. */
export function modelSwitchFields(Model: any): ModelCreateField[] {
  return modelSwitches(Model).map(entry => ({
    name: entry.name,
    label: modelColumnLabel(Model, entry.name),
    type: 'boolean' as const,
    required: false,
    defaultValue: false,
    options: [],
    help: entry.help,
    switch: {
      ...(entry.only ? { only: entry.only } : {}),
      ...(entry.lockedHelp ? { lockedHelp: entry.lockedHelp } : {}),
    },
  }))
}

/** The columns the switches read, for the page to know they are asked for and not only shown. */
export function modelSwitchColumns(Model: any): string[] {
  return modelSwitches(Model).map(entry => entry.column)
}

export interface ModelSwitchRequest {
  switch: ModelSwitch
  on: boolean
}

/** What a save can ask of a switch, however a form or an API caller spells yes and no. */
function askedState(value: unknown): boolean | null {
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 'on')
    return true
  if (value === false || value === 0 || value === '0' || value === 'false' || value === 'off')
    return false
  return null
}

/**
 * The switches a save names, by field or by column, and what it asks of
 * each. A value that is not a yes or a no is refused and not guessed at: a
 * date sent for `email_verified_at` must not read as "off".
 */
export function requestedSwitches(Model: any, body: Record<string, unknown>): { asked: ModelSwitchRequest[], errors: Record<string, string[]> } {
  const asked: ModelSwitchRequest[] = []
  const errors: Record<string, string[]> = {}
  for (const entry of modelSwitches(Model)) {
    const key = [entry.name, entry.column].find(name => Object.prototype.hasOwnProperty.call(body, name))
    if (key === undefined)
      continue
    const on = askedState(body[key])
    if (on === null)
      errors[entry.name] = [`${modelColumnLabel(Model, entry.name)} is on or off.`]
    else
      asked.push({ switch: entry, on })
  }
  return { asked, errors }
}

/**
 * Of the switches a save asks for, the ones that would change something and
 * the ones that cannot be turned that way.
 *
 * `stored` is the record's row as the database has it. A switch already
 * where it is asked to be is neither: asking twice is not a mistake.
 */
export function planSwitches(Model: any, asked: ModelSwitchRequest[], stored: Record<string, unknown>): { turning: ModelSwitchRequest[], errors: Record<string, string[]> } {
  const turning: ModelSwitchRequest[] = []
  const errors: Record<string, string[]> = {}
  for (const request of asked) {
    if (modelSwitchOn(stored[request.switch.column]) === request.on)
      continue
    if (request.switch.only && (request.switch.only === 'on') !== request.on) {
      errors[request.switch.name] = [request.switch.lockedHelp ?? `${modelColumnLabel(Model, request.switch.name)} cannot be turned ${request.on ? 'on' : 'off'} from here.`]
      continue
    }
    turning.push(request)
  }
  return { turning, errors }
}

/** What the switches of one record are stored as. Read from the table: the columns are not the model's own. */
export async function storedSwitches(Model: any, id: number): Promise<Record<string, unknown>> {
  const columns = modelSwitchColumns(Model)
  if (columns.length === 0)
    return {}
  const row = await db.selectFrom(String(Model.table) as never)
    .select(columns as never)
    .where(String(Model.primaryKey || 'id') as never, '=', id as never)
    .executeTakeFirst()
  return (row ?? {}) as Record<string, unknown>
}
