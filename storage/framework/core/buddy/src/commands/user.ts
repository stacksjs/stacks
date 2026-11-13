import type { CLI } from '@stacksjs/types'
import { randomBytes } from 'node:crypto'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

/**
 * `buddy user:add` — create an account from the command line.
 *
 * Every app reaches the point of needing a first real account: an admin for
 * the dashboard, a colleague who should be able to sign in, a support login
 * on a fresh box. Until now that meant opening a REPL against production and
 * hand-rolling a bcrypt hash, which is both fiddly and the kind of thing
 * people get wrong quietly (an unhashed password in the column authenticates
 * nobody, and nobody finds out until they try to sign in).
 *
 * The password is generated unless one is given, and printed once. It is
 * never written to a log file: `log` goes to disk in production, so the line
 * that carries the password goes to stdout directly.
 */

/** A password long enough that its randomness, not its shape, is the defence. */
function generatePassword(): string {
  // base64url over 18 bytes: 24 characters, no ambiguity about shell quoting.
  return randomBytes(18).toString('base64url')
}

/**
 * The project's User model, with its query API.
 *
 * Imported from the model file rather than `@stacksjs/orm`: the package's
 * re-export resolves to something else entirely in an installed app (the
 * name types as a boolean), so `User.where` is undefined and the command
 * fails on its first line. The app's own override wins over the framework
 * default, exactly as it does everywhere else.
 */
async function loadUserModel(): Promise<any> {
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')

  const candidates = [
    join(process.cwd(), 'app/Models/User.ts'),
    join(process.cwd(), 'storage/framework/defaults/app/Models/User.ts'),
    join(process.cwd(), 'node_modules/@stacksjs/defaults/app/Models/User.ts'),
  ]

  for (const candidate of candidates) {
    if (!existsSync(candidate))
      continue

    const loaded = (await import(candidate)).default
    if (loaded?.where)
      return loaded
  }

  // Last resort: the package export, in case a project lays its models out
  // somewhere none of the conventions cover.
  const { User } = await import('@stacksjs/orm')
  // `User.where` is a method on the model and so always defined - the probe
  // never decided anything. The import either resolves a model or it does not.
  if (User)
    return User

  await log.error('Could not find a User model. Looked in app/Models, the framework defaults and @stacksjs/orm.')
  await log.flush()
  process.exit(ExitCode.FatalError)
}

/** Reads and writes the stored password column, past the model (which hides it). */
export interface PasswordColumn {
  read: (address: string) => Promise<string>
  write: (address: string, hash: string) => Promise<void>
}

const usersTable: PasswordColumn = {
  async read(address) {
    const { db } = await import('@stacksjs/database')
    const row = await (db as any).selectFrom('users').select(['password']).where('email', '=', address).executeTakeFirst()
    return String(row?.password ?? '')
  },
  async write(address, hash) {
    const { db } = await import('@stacksjs/database')
    await (db as any).updateTable('users').set({ password: hash }).where('email', '=', address).execute()
  },
}

/**
 * Make sure the column holds a hash of `password`, never the password.
 *
 * A model `create` runs the model's password setter; a query-builder
 * `update` does not, and wrote the new password into the column as typed
 * (2026-11-08: `--update` stored the password in plain text, which signs
 * nobody in and sits readable in the database). So whatever wrote it, the
 * column is read back: anything that is not a recognisable hash is replaced
 * with one, and the result has to verify before the command says it worked.
 */
export async function ensureHashed(address: string, password: string, column: PasswordColumn = usersTable): Promise<void> {
  const { check, detectAlgorithm, make } = await import('@stacksjs/security')
  if (detectAlgorithm(await column.read(address)) === 'unknown')
    await column.write(address, await make(password, { algorithm: 'bcrypt' }))
  if (!await check(password, await column.read(address)))
    throw new Error(`The password stored for ${address} does not verify; it was not changed safely.`)
}

/** One account an audit wants a person to look at. */
export interface SuspectAccount {
  id: unknown
  email: string
  name: string
  /** Why the name would be refused at sign-up today. */
  reason: string
  verified: boolean
}

const AUDIT_REASONS: Record<string, string> = {
  link: 'link in name',
  markup: 'markup in name',
  control: 'control characters in name',
  characters: 'unusual characters in name',
  too_long: 'name too long',
}

/**
 * The accounts whose name registration would refuse today, most telling
 * reason first. A missing or one-letter name is not listed: it is untidy, not
 * an advert. Pure, so the rule is testable without a database.
 */
export async function suspectAccounts(rows: Array<Record<string, unknown>>): Promise<SuspectAccount[]> {
  const { displayNameProblem } = await import('@stacksjs/auth/display-name')
  const order = Object.keys(AUDIT_REASONS)
  const found: Array<SuspectAccount & { rank: number }> = []

  for (const row of rows) {
    const problem = displayNameProblem(row.name)
    const reason = problem ? AUDIT_REASONS[problem] : undefined
    if (!problem || !reason)
      continue
    found.push({
      id: row.id,
      email: String(row.email ?? ''),
      // One line each, whatever the name holds: this is printed to a terminal.
      // eslint-disable-next-line no-control-regex
      name: String(row.name ?? '').replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, ' ').slice(0, 120),
      reason,
      verified: row.email_verified_at != null,
      rank: order.indexOf(problem),
    })
  }

  return found.sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...account }) => account)
}

export function user(buddy: CLI): void {
  buddy
    .command('user:add <email>', 'Create a user account (optionally an admin)')
    .option('--name <name>', 'Display name. Defaults to the local part of the email.')
    .option('--password <password>', 'Password. Generated and printed once if omitted.')
    .option('--role <role>', 'Role to assign, e.g. admin. Seeds the default roles if the table is empty.')
    .option('--update', 'If the account already exists, reset its password and ensure the role', { default: false })
    .example('buddy user:add chris@example.com --role admin')
    .example('buddy user:add support@example.com --name Support --password s3cret')
    .action(async (email: string, options: { name?: string, password?: string, role?: string, update?: boolean }) => {
      const address = String(email || '').trim().toLowerCase()

      if (!address.includes('@')) {
        await log.error(`\`${email}\` is not an email address.`)
        await log.flush()
        process.exit(ExitCode.FatalError)
      }

      const password = options.password || generatePassword()
      const generated = !options.password
      const name = options.name || address.split('@')[0]

      const User = await loadUserModel()

      let account = await User.where('email', address).first()

      if (account && !options.update) {
        await log.error(`${address} already exists. Pass --update to reset its password and role.`)
        await log.flush()
        process.exit(ExitCode.FatalError)
      }

      const existed = Boolean(account)
      if (existed) {
        // A query-builder update runs no model setter: hash it here.
        const { make } = await import('@stacksjs/security')
        await User.where('email', address).update({ password: await make(password) })
      }
      else {
        await User.create({ email: address, name, password })
        account = await User.where('email', address).first()
      }

      try {
        await ensureHashed(address, password)
      }
      catch (error) {
        await log.error(error instanceof Error ? error.message : String(error))
        await log.flush()
        process.exit(ExitCode.FatalError)
      }
      log.success(`${existed ? 'Updated' : 'Created'} ${address}`)

      if (options.role) {
        const { createBqbRbacStore, Rbac, seedDefaultRoles } = await import('@stacksjs/auth')

        try {
          // RBAC reads through a store that the HTTP layer configures on boot.
          // A CLI has no such boot, and every call threw "RBAC store not
          // configured" — from a command whose whole job is to assign a role.
          Rbac.setStore(createBqbRbacStore())

          // A fresh app has no roles at all, and assigning one that does not
          // exist fails in a way that reads like a bug rather than a missing
          // seed. Seeding first is idempotent.
          await seedDefaultRoles()

          await Rbac.assignRole(account, options.role)
          log.success(`Assigned the ${options.role} role`)
        }
        catch (error) {
          log.error(`Could not assign the ${options.role} role: ${error instanceof Error ? error.message : String(error)}`)
          log.info('The account exists; assign the role once the roles tables are migrated.')
        }
      }

      if (generated) {
        // Straight to stdout: `log` writes to a file in production, and a
        // password does not belong in one.
        process.stdout.write(`\n  ${address}\n  ${password}\n\n`)
        log.info('That password is shown once. Store it in a password manager now.')
      }

      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('user:list', 'List the accounts that can sign in')
    .option('--limit <limit>', 'How many to show', { default: '25' })
    .action(async (options: { limit?: string }) => {
      const User = await loadUserModel()
      const limit = Number(options.limit) || 25

      const rows = await User.orderBy('id').limit(limit).get()

      if (rows.length === 0) {
        log.info('No accounts yet. Create one with `buddy user:add <email> --role admin`.')
        await log.flush()
        process.exit(ExitCode.Success)
      }

      for (const row of rows)
        process.stdout.write(`  ${String(row.id).padStart(4)}  ${String(row.email).padEnd(34)} ${row.name ?? ''}\n`)

      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('user:audit', 'List accounts whose name looks like an advert (a link, markup, or far too long)')
    .option('--json', 'Print the findings as JSON', { default: false })
    .example('buddy user:audit')
    .example('buddy user:audit --json')
    .action(async (options: { json?: boolean }) => {
      // Reads every account, straight from the table: the model hides
      // columns and pages, and an audit that stops at 25 rows finds nothing.
      // It lists. It never changes or removes an account; what to do with
      // one is a person's decision.
      const { db } = await import('@stacksjs/database')
      const rows = await (db as any).selectFrom('users').selectAll().orderBy('id').execute() as Array<Record<string, unknown>>
      const suspects = await suspectAccounts(rows)

      if (options.json) {
        process.stdout.write(`${JSON.stringify({ accounts: rows.length, suspects }, null, 2)}\n`)
      }
      else if (suspects.length === 0) {
        log.success(`${rows.length} accounts, none with a name that looks like an advert.`)
      }
      else {
        for (const account of suspects)
          process.stdout.write(`  ${String(account.id).padStart(4)}  ${account.email.padEnd(34)} ${account.reason.padEnd(26)} ${account.verified ? 'verified  ' : 'unverified'}  ${account.name}\n`)
        log.info(`${suspects.length} of ${rows.length} accounts to review. Nothing was changed.`)
      }

      await log.flush()
      process.exit(ExitCode.Success)
    })
}
