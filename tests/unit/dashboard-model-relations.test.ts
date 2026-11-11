import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { schema } from '@stacksjs/validation'
import { loadModelRegistry } from '../../storage/framework/core/orm/src/model-registry'
import {
  belongsToRelations,
  missingRelationErrors,
  modelHintColumn,
  modelLabelColumn,
  modelSlug,
} from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-relations'
import { humanizeIdentifier, modelCreateFields, prepareModelFields } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'

/**
 * Choosing another model's record by name (stacksjs/stacks#3257).
 *
 * A `belongsTo` is stored as a number, and the forms asked for the number: to
 * put a member in a team, find the team, read its id off the page, come back
 * and type it. The forms now ask for the team, and a record's page says which
 * team it is.
 */
const actions = '../../storage/framework/defaults/app/Actions/Dashboard/Models'
const { default: ModelOptionsAction } = await import(`${actions}/ModelOptionsAction`)
const { default: ModelStoreAction } = await import(`${actions}/ModelStoreAction`)
const { default: ModelUpdateAction } = await import(`${actions}/ModelUpdateAction`)

const field = (rule: unknown, extra: Record<string, unknown> = {}) => ({ fillable: true, validation: { rule }, ...extra })

describe('which fields are relations', () => {
  test('a declared belongsTo, in either spelling', () => {
    expect(belongsToRelations({ belongsTo: ['Team', { model: 'BoardColumn', onDelete: 'cascade' }] })).toEqual([
      { model: 'Team', slug: 'team', field: 'teamId', column: 'team_id' },
      { model: 'BoardColumn', slug: 'board-column', field: 'boardColumnId', column: 'board_column_id' },
    ])
  })

  test('the foreign key the model names, when it is not the conventional one', () => {
    expect(belongsToRelations({ belongsTo: [{ model: 'User', foreignKey: 'created_by_user_id' }] }))
      .toEqual([{ model: 'User', slug: 'user', field: 'createdByUserId', column: 'created_by_user_id' }])
  })

  test('nothing else, and nothing twice', () => {
    expect(belongsToRelations({})).toEqual([])
    expect(belongsToRelations({ belongsTo: ['', { onDelete: 'cascade' }, 'Team', 'Team'] }).map(relation => relation.field)).toEqual(['teamId'])
    expect(modelSlug('SmsOptOut')).toBe('sms-opt-out')
  })

  test('a relation is one field, the picker, whether or not the model also spells its key out', () => {
    const fields = modelCreateFields({
      belongsTo: ['Team', 'User'],
      attributes: {
        // Spelled out, and required: still one field, now a picker.
        userId: field(schema.number().required()),
        role: field(schema.enum(['member', 'admin'])),
      },
    })
    expect(fields.map(entry => [entry.name, entry.type, entry.label, entry.required])).toEqual([
      ['userId', 'relation', 'User', true],
      ['role', 'enum', 'Role', false],
      ['teamId', 'relation', 'Team', false],
    ])
    expect(fields[0]!.relation).toEqual({ model: 'User', slug: 'user', label: 'User' })
  })

  test('an id of something that is not a declared relation is left as it is', () => {
    // An external id, a provider's id, a polymorphic subject: no one model to list.
    const fields = modelCreateFields({
      attributes: {
        externalId: field(schema.string()),
        subjectId: field(schema.number()),
        createdByUserId: field(schema.number()),
      },
    })
    expect(fields.map(entry => entry.type)).toEqual(['text', 'number', 'number'])
    expect(fields.every(entry => entry.relation === undefined)).toBe(true)
  })

  test('holds for every shipped model: each belongsTo is asked for as a relation', async () => {
    const models = await loadModelRegistry({
      defaultsRoot: resolve('storage/framework/defaults/app/Models'),
      userRoot: join(tmpdir(), 'stacks-no-user-models'),
    }) as Record<string, any>
    const wrong: string[] = []
    let relations = 0
    for (const [name, model] of Object.entries(models)) {
      const fields = Object.fromEntries(modelCreateFields(model).map(entry => [entry.name, entry]))
      for (const relation of belongsToRelations(model)) {
        const entry = fields[relation.field]
        // Protected and hidden keys are not in the form at all.
        if (!entry)
          continue
        relations += 1
        if (entry.type !== 'relation' || entry.relation?.slug !== relation.slug)
          wrong.push(`${name}.${relation.field}`)
      }
    }
    expect(wrong).toEqual([])
    expect(relations).toBeGreaterThan(90)
  })
})

describe('what a picker sends becomes an id', () => {
  const Member = { belongsTo: ['Team'], attributes: { role: field(schema.string()) } }

  test('a chosen record is its id, as a number', () => {
    expect(prepareModelFields(Member, { teamId: '5' }, true)).toEqual({ data: { teamId: 5 }, errors: {} })
    expect(prepareModelFields(Member, { team_id: 5 }, true)).toEqual({ data: { teamId: 5 }, errors: {} })
  })

  test('a cleared one is null', () => {
    expect(prepareModelFields(Member, { teamId: null }, true).data).toEqual({ teamId: null })
    expect(prepareModelFields(Member, { teamId: '' }, true).data).toEqual({ teamId: null })
  })

  test('anything that is not an id is refused, on its field', () => {
    for (const value of ['abc', 0, -3, 1.5, '1.5'])
      expect(prepareModelFields(Member, { teamId: value }, true)).toEqual({ data: {}, errors: { teamId: ['Team must be chosen from the list.'] } })
  })
})

describe('what a record is called', () => {
  const columns = (...names: string[]) => ({ attributes: Object.fromEntries(names.map(name => [name, { fillable: true }])) })

  test('its name, title or address, most telling first', () => {
    expect(modelLabelColumn(columns('email', 'name'))).toBe('name')
    expect(modelLabelColumn(columns('slug', 'title'))).toBe('title')
    expect(modelLabelColumn(columns('status', 'email'))).toBe('email')
    expect(modelLabelColumn(columns('status', 'position'))).toBeNull()
  })

  test('a hidden column never names a record', () => {
    expect(modelLabelColumn({ attributes: { name: { hidden: true }, code: {} } })).toBe('code')
  })

  test('a person\'s email tells two of the same name apart', () => {
    expect(modelHintColumn(columns('name', 'email'))).toBe('email')
    // When the email is the name there is nothing to add.
    expect(modelHintColumn(columns('email', 'status'))).toBeNull()
    expect(modelHintColumn(columns('name'))).toBeNull()
  })
})

describe('the options endpoint', () => {
  interface Call { method: string, args: unknown[] }
  const globals = globalThis as Record<string, unknown>
  const names = ['Gadget', 'Unnamed']

  function fakeModel(definition: Record<string, unknown>, rows: Array<Record<string, unknown>>) {
    const calls: Call[] = []
    const chain: any = {
      whereIn: (...args: unknown[]) => (calls.push({ method: 'whereIn', args }), chain),
      whereGroup: (build: (group: any) => any) => {
        const group: any = {
          whereRaw: (...args: unknown[]) => (calls.push({ method: 'whereRaw', args }), group),
          orWhereRaw: (...args: unknown[]) => (calls.push({ method: 'orWhereRaw', args }), group),
        }
        build(group)
        return chain
      },
      orderBy: (...args: unknown[]) => (calls.push({ method: 'orderBy', args }), chain),
      take: (...args: unknown[]) => (calls.push({ method: 'take', args }), chain),
      get: async () => rows,
    }
    return { calls, Model: { ...definition, where: () => {}, query: () => chain } }
  }

  const ask = async (slug: string, input: Record<string, unknown> = {}) => {
    const result = await ModelOptionsAction.handle({ getParam: (key: string) => ({ slug } as Record<string, string>)[key], all: () => input } as any)
    return result instanceof Response ? { status: result.status, body: await result.json() } : { status: 200, body: result as any }
  }

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

  const gadget = { name: 'Gadget', attributes: { name: {}, email: {}, secret: { hidden: true } } }

  test('lists records by name, a person\'s email beside it', async () => {
    const { Model, calls } = fakeModel(gadget, [{ id: 2, name: 'Ada', email: 'ada@example.com' }, { id: 5, name: '', email: '' }])
    globals.Gadget = Model
    const { body } = await ask('gadget')
    expect(body.options).toEqual([
      { id: 2, label: 'Ada', hint: 'ada@example.com' },
      // Nothing to call it by: its id says which.
      { id: 5, label: 'Gadget #5', hint: '' },
    ])
    expect(calls).toEqual([{ method: 'orderBy', args: ['name', 'asc'] }, { method: 'take', args: [20] }])
  })

  test('a search matches the name or the email, whatever its case, and an id when it is a number', async () => {
    const { Model, calls } = fakeModel(gadget, [])
    globals.Gadget = Model
    await ask('gadget', { q: '  Ada ' })
    expect(calls.slice(0, 2)).toEqual([
      { method: 'whereRaw', args: ['LOWER(name) LIKE LOWER(?)', '%Ada%'] },
      { method: 'orWhereRaw', args: ['LOWER(email) LIKE LOWER(?)', '%Ada%'] },
    ])
    calls.length = 0
    await ask('gadget', { q: '13' })
    expect(calls[2]).toEqual({ method: 'orWhereRaw', args: ['id = ?', 13] })
  })

  test('asked for ids, answers for exactly those', async () => {
    const { Model, calls } = fakeModel(gadget, [{ id: 7, name: 'Bob', email: '' }])
    globals.Gadget = Model
    const { body } = await ask('gadget', { ids: '7, 7, x, -1, 9', q: 'ignored' })
    expect(calls[0]).toEqual({ method: 'whereIn', args: ['id', [7, 9]] })
    expect(body.options).toEqual([{ id: 7, label: 'Bob', hint: '#7' }])
  })

  test('a model with nothing to call its records by is searched by id only', async () => {
    const { Model, calls } = fakeModel({ name: 'Unnamed', attributes: { position: {} } }, [{ id: 3 }])
    globals.Unnamed = Model
    // A word cannot match: no records, and no query that would return them all.
    expect((await ask('unnamed', { q: 'ada' })).body.options).toEqual([])
    expect(calls).toEqual([])
    expect((await ask('unnamed', { q: '3' })).body.options).toEqual([{ id: 3, label: 'Unnamed #3', hint: '' }])
    expect(calls[0]).toEqual({ method: 'whereRaw', args: ['id = ?', 3] })
  })

  test('refuses a model the dashboard cannot reach, and a slug that is not one', async () => {
    expect((await ask('no-such-model')).status).toBe(404)
    expect((await ask('Bad_Slug')).status).toBe(400)
  })
})

describe('a record that is gone', () => {
  const referenced = Object.assign(new Error('insert or update on table "members" violates foreign key constraint'), { code: 'ERR_POSTGRES_SERVER_ERROR', errno: '23503' })
  const Member = { name: 'Member', belongsTo: ['Team', 'User'], attributes: { role: { fillable: true } }, traits: { useApi: true } }

  test('is named on the field that points at it', () => {
    expect(missingRelationErrors(Member, referenced, ['team_id', 'role'], humanizeIdentifier)).toEqual({ teamId: ['That team no longer exists. Choose another.'] })
    expect(missingRelationErrors(Member, referenced, ['team_id', 'user_id'], humanizeIdentifier)).toEqual({
      teamId: ['That team no longer exists. Choose another.'],
      userId: ['That user no longer exists. Choose another.'],
    })
  })

  test('only for that refusal, and only when a relation was being written', () => {
    expect(missingRelationErrors(Member, new Error('database is locked'), ['team_id'], humanizeIdentifier)).toEqual({})
    expect(missingRelationErrors(Member, referenced, ['role'], humanizeIdentifier)).toEqual({})
  })

  test('the create and edit endpoints answer it as a refusal, not a failure', async () => {
    const globals = globalThis as Record<string, unknown>
    if ('Member' in globals)
      throw new Error('a global named Member already exists')
    globals.Member = {
      ...Member,
      where: () => {},
      find: async () => ({ id: 1 }),
      create: async () => {
        throw referenced
      },
      update: async () => {
        throw referenced
      },
    }
    try {
      const request = (params: Record<string, string>, fields: Record<string, unknown>) => ({ getParam: (key: string) => params[key], all: () => ({ fields }) }) as any
      const read = async (result: unknown) => result instanceof Response ? { status: result.status, body: await result.json() } : { status: 200, body: result }
      const expected = { status: 422, body: { message: 'Validation failed.', errors: { teamId: ['That team no longer exists. Choose another.'] } } }
      expect(await read(await ModelStoreAction.handle(request({ slug: 'member' }, { teamId: 9, role: 'member' })))).toEqual(expected)
      expect(await read(await ModelUpdateAction.handle(request({ slug: 'member', id: '1' }, { teamId: 9 })))).toEqual(expected)
    }
    finally {
      delete globals.Member
    }
  })
})
