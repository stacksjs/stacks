import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { destroyModelRecord } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-destroy'
import { modelWriteCapabilities } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'

/**
 * Deleting a user other records still point at (stacksjs/stacks#3253).
 *
 * Nineteen tables point at `users`, so the database refused to delete anyone
 * who had signed in, joined a team or placed an order, and the dashboard said
 * so and stopped. Such a user is now erased the way the app's own rules say
 * a person is: by default anonymized, with the records that refer to them
 * kept.
 */
const referenced = () => Object.assign(new Error('FOREIGN KEY constraint failed'), { code: 'SQLITE_CONSTRAINT_FOREIGNKEY' })

function model(name: string, onDelete?: () => void) {
  const calls = { deleted: 0 }
  return {
    calls,
    Model: {
      name,
      find: async (id: number) => id === 404
        ? null
        : {
            delete: async () => {
              onDelete?.()
              calls.deleted += 1
            },
          },
    },
  }
}

describe('deleting a user, against a real database', () => {
  it('deletes one nothing refers to, and anonymizes one that is referred to', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stacks-user-delete-'))
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/user-delete-anonymize.ts`], {
        env: { ...process.env, APP_ENV: 'test', MAIL_MAILER: 'log', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'users.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 50_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('user delete OK')
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

describe('what a refused delete becomes', () => {
  const erasing = (action: 'anonymize' | 'delete' | 'keep') => {
    const erased: Array<[number, string]> = []
    return { erased, erase: async (id: number, actor: string) => (erased.push([id, actor]), { action }) }
  }

  it('a plain delete erases nothing', async () => {
    const { Model, calls } = model('User')
    const { erase, erased } = erasing('anonymize')
    expect(await destroyModelRecord(7, { Model, erase, actor: 'dashboard' })).toEqual({ ok: true, outcome: 'deleted' })
    expect(calls.deleted).toBe(1)
    expect(erased).toEqual([])
  })

  it('a user the database keeps is erased by the app\'s rules, recorded against who asked', async () => {
    const { Model } = model('User', () => {
      throw referenced()
    })
    const { erase, erased } = erasing('anonymize')
    expect(await destroyModelRecord(7, { Model, erase, actor: 'dashboard:user:3' })).toEqual({ ok: true, outcome: 'anonymized' })
    expect(erased).toEqual([[7, 'dashboard:user:3']])
  })

  it('reports what the rules did, when they are not the default', async () => {
    const blocked = () => model('User', () => {
      throw referenced()
    }).Model
    // An app whose rules delete the user's own row: gone, not anonymized.
    expect(await destroyModelRecord(7, { Model: blocked(), erase: erasing('delete').erase, actor: 'dashboard' })).toEqual({ ok: true, outcome: 'deleted' })
    // Rules that keep it untouched changed nothing, so the refusal stands.
    expect(await destroyModelRecord(7, { Model: blocked(), erase: erasing('keep').erase, actor: 'dashboard' })).toEqual({ ok: false, reason: 'referenced' })
  })

  it('any other model the database keeps is still refused, and nobody is erased', async () => {
    const { Model } = model('Team', () => {
      throw referenced()
    })
    const { erase, erased } = erasing('anonymize')
    expect(await destroyModelRecord(7, { Model, erase, actor: 'dashboard' })).toEqual({ ok: false, reason: 'referenced' })
    expect(erased).toEqual([])
  })

  it('an erasure that meets the same foreign keys is the same refusal', async () => {
    const { Model } = model('User', () => {
      throw referenced()
    })
    const erase = async () => {
      throw referenced()
    }
    expect(await destroyModelRecord(7, { Model, erase, actor: 'dashboard' })).toEqual({ ok: false, reason: 'referenced' })
  })

  it('an erasure that fails is reported as that, not as a failed delete', async () => {
    const { Model } = model('User', () => {
      throw referenced()
    })
    const cause = new Error('The \'gdpr_requests\' table does not exist')
    const erase = async () => {
      throw cause
    }
    expect(await destroyModelRecord(7, { Model, erase, actor: 'dashboard' })).toEqual({ ok: false, reason: 'erasure-failed', cause })
  })

  it('a delete that fails for another reason erases nobody', async () => {
    const cause = new Error('database is locked')
    const { Model } = model('User', () => {
      throw cause
    })
    const { erase, erased } = erasing('anonymize')
    expect(await destroyModelRecord(7, { Model, erase, actor: 'dashboard' })).toEqual({ ok: false, reason: 'failed', cause })
    expect(erased).toEqual([])
  })

  it('a record that is not there is missing', async () => {
    const { Model } = model('User')
    expect(await destroyModelRecord(404, { Model, erase: erasing('anonymize').erase, actor: 'dashboard' })).toEqual({ ok: false, reason: 'missing' })
  })
})

describe('the confirmation can say so beforehand', () => {
  it('the capability is true for a deletable User and for nothing else', () => {
    expect(modelWriteCapabilities({ name: 'User', traits: { useAuth: true }, dashboard: { writes: ['update', 'destroy'] } }).anonymize).toBe(true)
    expect(modelWriteCapabilities({ name: 'User', traits: { useAuth: true }, dashboard: { writes: ['update'] } }).anonymize).toBe(false)
    expect(modelWriteCapabilities({ name: 'Team', traits: { useApi: true } }).anonymize).toBe(false)
  })
})
