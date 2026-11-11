import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { modelWriteCapabilities } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'
import { inviteUser } from '../../storage/framework/defaults/app/Actions/Dashboard/Users/user-invitation'

/**
 * Adding a user from the dashboard, by invitation (stacksjs/stacks#3252).
 *
 * The Users page could edit and delete and still had no way to add anyone:
 * `User.password` is required and no form can supply it. The account is now
 * created with a password nobody knows, and its holder is mailed the
 * framework's account-setup link to choose their own.
 */
function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('inviting a user', () => {
  it('creates the account, sends the link, and leaves nothing behind when the mail fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stacks-user-invitation-'))
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/user-invitation.ts`], {
        env: { ...process.env, APP_ENV: 'test', MAIL_MAILER: 'log', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'invitations.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 50_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('user invitation OK')
      }
      finally {
        clearTimeout(watchdog)
        child.kill()
      }
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  }, 60_000)
})

describe('when the invitation cannot be undone', () => {
  const attributes = { name: { fillable: true, required: true }, email: { fillable: true, required: true } }

  function fakes(overrides: Record<string, unknown> = {}) {
    const calls = { created: [] as Array<Record<string, unknown>>, deleted: 0, cleared: [] as string[] }
    const dependencies = {
      Model: {
        attributes,
        create: async (row: Record<string, unknown>) => {
          calls.created.push(row)
          return { id: 31 }
        },
        find: async () => ({
          delete: async () => {
            calls.deleted += 1
          },
        }),
      },
      findUserByEmail: async () => undefined,
      clearSetupLinks: async (email: string) => void calls.cleared.push(email),
      sendSetupLink: async () => true,
      ...overrides,
    }
    return { calls, dependencies }
  }

  it('gives the account a password nobody chose, different every time', async () => {
    const { calls, dependencies } = fakes()
    await inviteUser({ name: 'Ada Lovelace', email: 'ada@example.com' }, dependencies)
    await inviteUser({ name: 'Bob Kahn', email: 'bob@example.com' }, dependencies)
    const [first, second] = calls.created.map(row => String(row.password))
    expect(first!.length).toBeGreaterThanOrEqual(32)
    expect(first).not.toBe(second)
    expect(calls.created[0]).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' })
    expect(calls.deleted).toBe(0)
  })

  it('says the account was left behind when it could not be removed', async () => {
    const { dependencies } = fakes({ sendSetupLink: async () => false })
    dependencies.Model.find = async () => ({
      delete: async () => {
        throw new Error('FOREIGN KEY constraint failed')
      },
    })
    const result = await inviteUser({ name: 'Ada Lovelace', email: 'ada@example.com' }, dependencies)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.reason).toBe('stranded')
  })

  it('reports a create the database refused as a failure, having mailed nothing', async () => {
    let mailed = 0
    const { dependencies } = fakes({ sendSetupLink: async () => (mailed += 1) > 0 })
    dependencies.Model.create = async () => {
      throw new Error('database is locked')
    }
    const result = await inviteUser({ name: 'Ada Lovelace', email: 'ada@example.com' }, dependencies)
    expect(!result.ok && result.reason).toBe('failed')
    expect(mailed).toBe(0)
  })

  it('two invitations for one address at once: the second is told it is taken', async () => {
    const { dependencies } = fakes()
    dependencies.Model.create = async () => {
      throw Object.assign(new Error('UNIQUE constraint failed: users.email'), { code: 'SQLITE_CONSTRAINT_UNIQUE' })
    }
    expect(await inviteUser({ name: 'Ada Lovelace', email: 'ada@example.com' }, dependencies))
      .toEqual({ ok: false, reason: 'invalid', errors: { email: ['A user with this email already exists.'] } })
  })
})

describe('which models are added by invitation', () => {
  const password = { fillable: true, hidden: true, validation: { rule: { isRequired: true } } }
  const user = { name: 'User', traits: { useAuth: true }, attributes: { password }, dashboard: { writes: ['store', 'update', 'destroy'] } }

  it('User, when the dashboard may create one', () => {
    expect(modelWriteCapabilities(user)).toEqual({ create: false, update: true, destroy: true, invite: true })
  })

  it('not a User the dashboard may not create', () => {
    expect(modelWriteCapabilities({ ...user, dashboard: { writes: ['update', 'destroy'] } }).invite).toBe(false)
    expect(modelWriteCapabilities({ ...user, dashboard: undefined, traits: { useAuth: true, useApi: { routes: ['index', 'show'] } } }).invite).toBe(false)
  })

  it('not another model, account or otherwise', () => {
    // The setup link is the users table's.
    expect(modelWriteCapabilities({ ...user, name: 'Admin' }).invite).toBe(false)
    expect(modelWriteCapabilities({ name: 'User', traits: { useApi: true } }).invite).toBe(false)
    expect(modelWriteCapabilities({ name: 'Team', traits: { useApi: true } })).toEqual({ create: true, update: true, destroy: true, invite: false })
  })

  it('the User model allows it, and still keeps every write off its API', () => {
    const model = source('storage/framework/defaults/app/Models/User.ts')
    expect(model).toContain('writes: [\'store\', \'update\', \'destroy\'],')
    expect(model).toContain('routes: [\'index\', \'store\', \'show\'],')
  })
})

describe('the invitation endpoint', () => {
  it('is a guarded endpoint of its own', () => {
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')
    expect(routes).toContain('guard(route.post(\'/users/invitations\', \'Actions/Dashboard/Users/UserInviteAction\'))')
    const action = source('storage/framework/defaults/app/Actions/Dashboard/Users/UserInviteAction.ts')
    expect(action).toContain('if (!modelWriteCapabilities(resolved.Model).invite)')
    expect(action).toContain('passwordResets(email).sendEmail({ purpose: \'setup\', expiresAt })')
    // The password is never the operator's to send.
    expect(action).not.toContain('input.password')
  })
})

describe('the mail says how long the link lasts in words', () => {
  it('uses the lifetime it is given', () => {
    const template = source('storage/framework/defaults/resources/emails/password-reset.stx')
    expect(template).toContain('This link will expire in <strong>{{ expiresIn }}</strong>.')
    expect(template).not.toContain('{{ expireMinutes }} minutes')
  })
})
