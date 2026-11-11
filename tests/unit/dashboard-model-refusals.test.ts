import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  duplicateFieldErrors,
  modelDashboardWrites,
  modelWriteCapabilities,
} from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'

/**
 * Editing and deleting from the dashboard's record pages, for the models
 * whose API should not offer the same thing, and what the visitor is told
 * when a write is refused (stacksjs/stacks#3251).
 *
 * The Users page had an eye and nothing else. Its model keeps `update` and
 * `destroy` off the generated API on purpose, and the dashboard took its
 * pencil and trash from that same list. Once they were given back, three
 * refusals a person can act on were still reported as failures of the server.
 */
const actions = '../../storage/framework/defaults/app/Actions/Dashboard/Models'
const { default: ModelDestroyAction } = await import(`${actions}/ModelDestroyAction`)
const { default: ModelUpdateAction } = await import(`${actions}/ModelUpdateAction`)

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

interface Fake {
  deleted: number[]
  updated: Array<{ id: number, changes: Record<string, unknown> }>
}

/** A model as the dashboard resolves one: the global the ORM would inject. */
function fakeModel(definition: Record<string, unknown>, behaviour: { onDelete?: () => void, onUpdate?: () => void } = {}): Fake & Record<string, unknown> {
  const calls: Fake = { deleted: [], updated: [] }
  return {
    ...definition,
    ...calls,
    where: () => {},
    find: async (id: number) => id === 404
      ? null
      : {
          id,
          delete: async () => {
            behaviour.onDelete?.()
            calls.deleted.push(id)
          },
        },
    update: async (id: number, changes: Record<string, unknown>) => {
      behaviour.onUpdate?.()
      calls.updated.push({ id, changes })
    },
  }
}

function request(params: Record<string, unknown>, input: Record<string, unknown> = {}, user: unknown = null): any {
  return {
    getParam: (key: string) => params[key],
    all: () => input,
    user: async () => user,
  }
}

async function answer(result: unknown): Promise<{ status: number, body: any }> {
  if (result instanceof Response)
    return { status: result.status, body: await result.json() }
  return { status: 200, body: result }
}

const account = {
  name: 'Member',
  table: 'members',
  traits: { useAuth: true, useApi: { routes: ['index', 'store', 'show'] } },
  dashboard: { writes: ['update', 'destroy'] },
  attributes: {
    name: { fillable: true },
    email: { fillable: true, unique: true },
    password: { fillable: true, hidden: true },
  },
}

const globals = globalThis as Record<string, unknown>
const names = ['Member', 'Parent', 'Sealed', 'Plain']

describe('what the dashboard may write is the model\'s to say', () => {
  it('follows the useApi routes when the model names nothing', () => {
    expect(modelDashboardWrites({ traits: { useApi: true } })).toEqual(['store', 'update', 'destroy'])
    expect(modelDashboardWrites({ traits: { useApi: { routes: ['index', 'show', 'destroy'] } } })).toEqual(['destroy'])
    expect(modelDashboardWrites({ traits: {} })).toEqual([])
  })

  it('takes dashboard.writes over the routes, wider or narrower', () => {
    expect(modelDashboardWrites(account)).toEqual(['update', 'destroy'])
    expect(modelWriteCapabilities(account)).toEqual({ create: false, update: true, destroy: true })
    // Read-only in the dashboard whatever the API allows.
    expect(modelDashboardWrites({ traits: { useApi: true }, dashboard: { writes: [] } })).toEqual([])
  })

  it('ignores what is not a write, and a value that is not a list', () => {
    expect(modelDashboardWrites({ traits: {}, dashboard: { writes: ['index', 'show', 'truncate', 'update'] } })).toEqual(['update'])
    expect(modelDashboardWrites({ traits: { useApi: { routes: ['index', 'update'] } }, dashboard: { writes: 'destroy' } })).toEqual(['update'])
  })

  it('a named store still needs a form that can supply every required field', () => {
    const required = { isRequired: true }
    expect(modelWriteCapabilities({
      traits: {},
      dashboard: { writes: ['store'] },
      attributes: { password: { fillable: true, hidden: true, validation: { rule: required } } },
    }).create).toBe(false)
  })

  it('User is editable and deletable here and still not through its API', () => {
    const user = source('storage/framework/defaults/app/Models/User.ts')
    expect(user).toContain('routes: [\'index\', \'store\', \'show\'],')
    expect(user).toContain('writes: [\'update\', \'destroy\'],')
    // The floor registration applies, and a message that says the same number.
    expect(user).toContain('schema.string().required().min(2).max(100)')
    expect(user).toContain('Name must have a minimum of 2 characters')
  })
})

describe('refusals a person can act on', () => {
  beforeAll(() => {
    for (const name of names) {
      if (name in globals)
        throw new Error(`a global named ${name} already exists`)
    }
  })

  afterAll(() => {
    for (const name of names)
      delete globals[name]
  })

  it('names the field when an edit repeats a value another row holds', async () => {
    for (const refusal of [
      { code: 'SQLITE_CONSTRAINT_UNIQUE', message: 'UNIQUE constraint failed: members.email' },
      { code: 'ERR_POSTGRES_SERVER_ERROR', errno: '23505', message: 'duplicate key value violates unique constraint "members_email_key"' },
      { code: 'ERR_MYSQL_SERVER_ERROR', errno: 1062, message: 'Duplicate entry \'ada@example.com\' for key \'members.email\'' },
    ]) {
      globals.Member = fakeModel(account, {
        onUpdate: () => {
          throw Object.assign(new Error(refusal.message), refusal)
        },
      })
      const result = await answer(await ModelUpdateAction.handle(request({ slug: 'member', id: '7' }, { fields: { email: 'ada@example.com' } })))
      expect(result).toEqual({ status: 422, body: { message: 'Validation failed.', errors: { email: ['Email is already in use.'] } } })
    }
  })

  it('still reports a duplicate it cannot pin on a field as a failed save', async () => {
    globals.Member = fakeModel(account, {
      onUpdate: () => {
        throw Object.assign(new Error('UNIQUE constraint failed: members.slug'), { code: 'SQLITE_CONSTRAINT_UNIQUE' })
      },
    })
    const result = await answer(await ModelUpdateAction.handle(request({ slug: 'member', id: '7' }, { fields: { name: 'Ada Lovelace' } })))
    expect(result.status).toBe(500)
    expect(duplicateFieldErrors(account, ['name'])).toEqual({})
    expect(duplicateFieldErrors(account, ['name', 'email'])).toEqual({ email: ['Email is already in use.'] })
  })

  it('never writes a password from the edit form', async () => {
    const Member = fakeModel(account)
    globals.Member = Member
    const result = await answer(await ModelUpdateAction.handle(request({ slug: 'member', id: '7' }, { fields: { password: 'hunter2hunter2' } })))
    expect(result.status).toBe(422)
    expect(Member.updated).toEqual([])
  })

  it('says why a row other records point at was kept', async () => {
    for (const refusal of [
      { code: 'SQLITE_CONSTRAINT_FOREIGNKEY', message: 'FOREIGN KEY constraint failed' },
      { code: 'ERR_POSTGRES_SERVER_ERROR', errno: '23503', message: 'update or delete on table "parents" violates foreign key constraint' },
      { code: 'ERR_MYSQL_SERVER_ERROR', errno: 1451, message: 'Cannot delete or update a parent row: a foreign key constraint fails' },
    ]) {
      globals.Parent = fakeModel({ name: 'Parent', traits: { useApi: true } }, {
        onDelete: () => {
          throw Object.assign(new Error(refusal.message), refusal)
        },
      })
      const result = await answer(await ModelDestroyAction.handle(request({ slug: 'parent', id: '3' })))
      expect(result.status).toBe(409)
      expect(result.body.message).toBe('This parent cannot be deleted while other records still refer to it. Remove or reassign those records first.')
    }
  })

  it('keeps any other delete failure a failure', async () => {
    globals.Parent = fakeModel({ name: 'Parent', traits: { useApi: true } }, {
      onDelete: () => {
        throw new Error('database is locked')
      },
    })
    const result = await answer(await ModelDestroyAction.handle(request({ slug: 'parent', id: '3' })))
    expect(result).toEqual({ status: 500, body: { message: 'The model record could not be deleted.' } })
  })

  it('will not delete the account making the request', async () => {
    const Member = fakeModel(account)
    globals.Member = Member

    const own = await answer(await ModelDestroyAction.handle(request({ slug: 'member', id: '7' }, {}, { id: 7 })))
    expect(own.status).toBe(409)
    expect(own.body.message).toContain('You are signed in with this account')
    expect(Member.deleted).toEqual([])

    // Someone else's account, and the local dashboard that has no session.
    expect(await answer(await ModelDestroyAction.handle(request({ slug: 'member', id: '8' }, {}, { id: 7 })))).toEqual({ status: 200, body: { ok: true, id: 8 } })
    expect(await answer(await ModelDestroyAction.handle(request({ slug: 'member', id: '7' })))).toEqual({ status: 200, body: { ok: true, id: 7 } })
    expect(Member.deleted).toEqual([8, 7])
  })

  it('only guards accounts: a row whose id matches the viewer\'s is just a row', async () => {
    const Plain = fakeModel({ name: 'Plain', traits: { useApi: true } })
    globals.Plain = Plain
    expect((await answer(await ModelDestroyAction.handle(request({ slug: 'plain', id: '7' }, {}, { id: 7 })))).status).toBe(200)
    expect(Plain.deleted).toEqual([7])
  })

  it('refuses a write the model did not allow, by either route', async () => {
    globals.Sealed = fakeModel({ name: 'Sealed', traits: { useApi: true }, dashboard: { writes: [] } })
    const result = await answer(await ModelDestroyAction.handle(request({ slug: 'sealed', id: '1' })))
    expect(result.status).toBe(405)
    expect(result.body.message).toBe('Sealed records cannot be deleted from the dashboard: the model allows it in neither `dashboard.writes` nor its `useApi` routes.')
    expect((globals.Sealed as Fake).deleted).toEqual([])
  })
})

describe('the pages show it', () => {
  it('the edit form puts each refusal under its field', () => {
    const edit = source('storage/framework/defaults/resources/components/Dashboard/Models/ModelRecordEdit.stx')
    expect(edit).toContain('saveErrors.set(result.errors)')
    expect(edit).toContain('<p :if="fieldError(field.name)" role="alert"')
    expect(edit).toContain(':aria-invalid="fieldError(field.name) ? \'true\' : \'false\'"')
  })

  it('the delete confirmation is in plain words, in all three places', () => {
    const components = 'storage/framework/defaults/resources/components/Dashboard'
    for (const path of ['Data/DataRecords.stx', 'Models/ModelRecordDetail.stx', 'Models/ModelRecordsDashboard.stx']) {
      const page = source(`${components}/${path}`)
      expect(page).toContain('modelDeleteWarning(')
      expect(page).not.toContain('soft deletes and observers')
    }
  })
})
