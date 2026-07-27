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
  if ((User as any)?.where)
    return User

  log.error('Could not find a User model. Looked in app/Models, the framework defaults and @stacksjs/orm.')
  process.exit(ExitCode.FatalError)
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
        log.error(`\`${email}\` is not an email address.`)
        process.exit(ExitCode.FatalError)
      }

      const password = options.password || generatePassword()
      const generated = !options.password
      const name = options.name || address.split('@')[0]

      const User = await loadUserModel()

      let account = await User.where('email', address).first()

      if (account && !options.update) {
        log.error(`${address} already exists. Pass --update to reset its password and role.`)
        process.exit(ExitCode.FatalError)
      }

      if (account) {
        // The model's own setter hashes it, exactly as a create would.
        await User.where('email', address).update({ password })
        log.success(`Updated ${address}`)
      }
      else {
        await User.create({ email: address, name, password })
        account = await User.where('email', address).first()
        log.success(`Created ${address}`)
      }

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

          await Rbac.assignRole(account as any, options.role)
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
}
