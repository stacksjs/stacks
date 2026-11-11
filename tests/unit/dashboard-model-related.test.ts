import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { schema } from '@stacksjs/validation'
import { loadModelRegistry } from '../../storage/framework/core/orm/src/model-registry'
import { relatedPanel, relatedPanels, relatedSummaryColumns } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-related'
import { hasRelations, pluralizeLabel, relatedForeignKey } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-relations'
import { modelSchemaColumns } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'

/**
 * The records that point at a record, on its page (stacksjs/stacks#3258).
 *
 * A team's page said nothing of its members: to see them you opened Team
 * Members and filtered by a team id you had to remember. A model already
 * declares who points at it (`hasMany`, `hasOne`), and its page now lists
 * them, with nothing set up per model.
 */
const actions = '../../storage/framework/defaults/app/Actions/Dashboard/Models'
const { default: ModelRelatedAction } = await import(`${actions}/ModelRelatedAction`)

describe('who points at a model', () => {
  test('its hasMany and hasOne, in either spelling', () => {
    expect(hasRelations({ hasMany: ['TeamMember', { model: 'TeamInvitation', foreignKey: 'invitedTeamId' }], hasOne: ['Subscriber'] })).toEqual([
      { kind: 'many', model: 'TeamMember', slug: 'team-member', foreignKey: null },
      { kind: 'many', model: 'TeamInvitation', slug: 'team-invitation', foreignKey: 'invited_team_id' },
      { kind: 'one', model: 'Subscriber', slug: 'subscriber', foreignKey: null },
    ])
    expect(hasRelations({})).toEqual([])
    expect(hasRelations({ hasMany: ['', 'Card', 'Card'] }).map(relation => relation.model)).toEqual(['Card'])
  })

  test('the link is the one the declaration names, else the related model\'s own belongsTo, else the conventional column', () => {
    const relation = (foreignKey: string | null) => ({ kind: 'many' as const, model: 'Card', slug: 'card', foreignKey })
    expect(relatedForeignKey('Board', {}, relation('home_board_id'), [])).toBe('home_board_id')
    expect(relatedForeignKey('User', { belongsTo: [{ model: 'User', foreignKey: 'created_by_user_id' }] }, relation(null), [])).toBe('created_by_user_id')
    expect(relatedForeignKey('Board', {}, relation(null), ['id', 'board_id'])).toBe('board_id')
    expect(relatedForeignKey('BoardColumn', {}, relation(null), ['board_column_id'])).toBe('board_column_id')
  })

  test('with none of the three there is no panel, not a wrong one', () => {
    expect(relatedForeignKey('GiftCard', { belongsTo: ['Customer'] }, { kind: 'many', model: 'Order', slug: 'order', foreignKey: null }, ['id', 'customer_id'])).toBeNull()
  })

  test('a heading is the related model, plural', () => {
    expect(pluralizeLabel('Team Member')).toBe('Team Members')
    expect(pluralizeLabel('Category')).toBe('Categories')
    expect(pluralizeLabel('Email Address')).toBe('Email Addresses')
    expect(pluralizeLabel('Survey')).toBe('Surveys')
  })

  test('every shipped hasMany and hasOne resolves its link, but for one declaration that cannot', async () => {
    const models = await loadModelRegistry({
      defaultsRoot: resolve('storage/framework/defaults/app/Models'),
      userRoot: join(tmpdir(), 'stacks-no-user-models'),
    }) as Record<string, any>
    const unresolved: string[] = []
    let resolved = 0
    for (const [name, model] of Object.entries(models)) {
      for (const relation of hasRelations(model)) {
        const Related = models[relation.model]
        if (Related && relatedForeignKey(name, Related, relation, modelSchemaColumns(Related)))
          resolved += 1
        else
          unresolved.push(`${name} -> ${relation.model}`)
      }
    }
    // GiftCard says it has many Orders; an order has no column for a gift
    // card. It gets no panel. Anything new on this list is a declaration that
    // names a link the other model does not have.
    expect(unresolved).toEqual(['GiftCard -> Order'])
    expect(resolved).toBeGreaterThan(50)
  })
})

describe('the columns that say what each related record is', () => {
  const Member = {
    belongsTo: ['Team', 'User', 'Customer'],
    traits: {},
    attributes: {
      role: { validation: { rule: schema.enum(['member', 'admin']) } },
      status: { validation: { rule: schema.enum(['active', 'invited']) } },
      note: { validation: { rule: schema.string() } },
      secret: { hidden: true, validation: { rule: schema.enum(['a', 'b']) } },
    },
  }

  test('the other records it points at, its status-like fields, and when it was created', () => {
    expect(relatedSummaryColumns(Member, 'team_id', new Set(['User']))).toEqual([
      // The link back to the page's own record is left out: the same on every row.
      // Customer is not reachable (its feature is off), so it is not named.
      { key: 'user_id', label: 'User', type: 'text', relation: 'User' },
      { key: 'role', label: 'Role', type: 'badge' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'created_at', label: 'Created', type: 'datetime' },
    ])
  })

  test('its own name leads, when it has one', () => {
    const columns = relatedSummaryColumns({ attributes: { email: {}, title: {} }, traits: { useTimestamps: false } }, 'team_id', new Set())
    expect(columns).toEqual([{ key: 'title', label: 'Title', type: 'text' }])
  })

  test('the id, when there is neither a name nor another record to show', () => {
    expect(relatedSummaryColumns({ attributes: { position: {} }, traits: { useTimestamps: false } }, 'board_id', new Set()))
      .toEqual([{ key: 'id', label: 'ID', type: 'text' }])
  })

  test('never more than a few, with the created time kept', () => {
    const wide = { attributes: Object.fromEntries(['name', 'a', 'b', 'c', 'd', 'e', 'f'].map(key => [key, key === 'name' ? {} : { validation: { rule: schema.enum(['x', 'y']) } }])) }
    const columns = relatedSummaryColumns(wide, 'team_id', new Set())
    expect(columns).toHaveLength(5)
    expect(columns[0]!.key).toBe('name')
    expect(columns.at(-1)!.key).toBe('created_at')
  })
})

describe('a record\'s panels', () => {
  const globals = globalThis as Record<string, unknown>
  const names = ['Squad', 'SquadMember', 'SquadBadge', 'Pilot', 'Hangar']

  interface Queries { where: unknown[][], take: unknown[], whereIn: unknown[][] }

  /** A model as the dashboard resolves one: a global with a query. */
  function fakeModel(definition: Record<string, unknown>, rows: Array<Record<string, unknown>>, options: { fail?: boolean } = {}) {
    const queries: Queries = { where: [], take: [], whereIn: [] }
    const query = () => {
      let matched = rows
      let limit = Number.POSITIVE_INFINITY
      const chain: any = {
        where: (column: string, value: unknown) => {
          queries.where.push([column, value])
          matched = matched.filter(row => String(row[column]) === String(value))
          return chain
        },
        whereIn: (column: string, values: unknown[]) => {
          queries.whereIn.push([column, values])
          matched = matched.filter(row => values.map(String).includes(String(row[column])))
          return chain
        },
        orderBy: () => {
          matched = [...matched].sort((left, right) => Number(right.id) - Number(left.id))
          return chain
        },
        take: (count: number) => {
          queries.take.push(count)
          limit = count
          return chain
        },
        count: async () => {
          if (options.fail)
            throw new Error('no such table: squad_badges')
          return matched.length
        },
        get: async () => matched.slice(0, limit),
      }
      return chain
    }
    return { queries, Model: { ...definition, where: () => {}, query, find: async (id: number) => (id === 404 ? null : { id }) } }
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

  const members = Array.from({ length: 7 }, (_unused, index) => ({ id: index + 1, squad_id: 3, pilot_id: index === 6 ? null : 10 + index, role: index === 0 ? 'lead' : 'wing', created_at: `2026-11-0${index + 1} 09:00:00` }))
  const install = () => {
    globals.Pilot = fakeModel({ name: 'Pilot', attributes: { name: {} } }, [{ id: 10, name: 'Ada' }, { id: 15, name: 'Grace' }, { id: 14, name: 'Linus' }]).Model
    const member = fakeModel({
      name: 'SquadMember',
      belongsTo: ['Squad', 'Pilot'],
      traits: { useApi: true },
      attributes: { role: { fillable: true, validation: { rule: schema.enum(['lead', 'wing']) } } },
    }, [...members, { id: 99, squad_id: 4, pilot_id: 10, role: 'wing' }])
    globals.SquadMember = member.Model
    return member
  }

  test('the newest few of each, counted, with the records they point at named', async () => {
    const { queries } = install()
    const panel = await relatedPanel('Squad', 3, { kind: 'many', model: 'SquadMember', slug: 'squad-member', foreignKey: null })
    expect(panel).toMatchObject({ kind: 'many', title: 'Squad Members', label: 'Squad Member', foreignKey: 'squad_id', field: 'squadId', total: 7, canCreate: true })
    expect(panel!.columns).toEqual([
      { key: 'pilot_id', label: 'Pilot', type: 'text' },
      { key: 'role', label: 'Role', type: 'badge' },
      { key: 'created_at', label: 'Created', type: 'datetime' },
    ])
    // Newest first, five of the seven, and never another squad's.
    expect(panel!.rows.map(row => row.id)).toEqual([7, 6, 5, 4, 3])
    expect(queries.take).toEqual([5])
    expect(queries.where.every(([column, value]) => column === 'squad_id' && value === 3)).toBe(true)
    // Named where the pilot can be found, by id where it cannot, empty where there is none.
    expect(panel!.rows.map(row => row.pilot_id)).toEqual(['', 'Grace', 'Linus', 'Pilot #13', 'Pilot #12'])
    expect(panel!.rows[0]).toMatchObject({ role: 'wing', created_at: '2026-11-07 09:00:00' })
  })

  test('a hasOne shows the one', async () => {
    install()
    const panel = await relatedPanel('Pilot', 10, { kind: 'one', model: 'SquadMember', slug: 'squad-member', foreignKey: null })
    expect(panel).toMatchObject({ kind: 'one', title: 'Squad Member', total: 2 })
    expect(panel!.rows).toHaveLength(1)
  })

  test('a model the dashboard cannot reach, or with no link back, gets no panel', async () => {
    install()
    expect(await relatedPanel('Squad', 3, { kind: 'many', model: 'NoSuchModel', slug: 'no-such-model', foreignKey: null })).toBeNull()
    globals.Hangar = fakeModel({ name: 'Hangar', attributes: { name: {} } }, []).Model
    expect(await relatedPanel('Squad', 3, { kind: 'many', model: 'Hangar', slug: 'hangar', foreignKey: null })).toBeNull()
  })

  test('adding from the panel needs a form that can be told which record it starts from', async () => {
    globals.Pilot = fakeModel({ name: 'Pilot', attributes: { name: {} } }, []).Model
    // Reachable, but its API allows no create.
    globals.SquadMember = fakeModel({ name: 'SquadMember', belongsTo: ['Squad'], traits: { useApi: { routes: ['index', 'show'] } }, attributes: {} }, []).Model
    expect((await relatedPanel('Squad', 3, { kind: 'many', model: 'SquadMember', slug: 'squad-member', foreignKey: null }))!.canCreate).toBe(false)
    // Creatable, but linked by a column its form has no field for.
    globals.SquadMember = fakeModel({ name: 'SquadMember', traits: { useApi: true }, attributes: { squadId: {} } }, []).Model
    const panel = await relatedPanel('Squad', 3, { kind: 'many', model: 'SquadMember', slug: 'squad-member', foreignKey: null })
    expect(panel).toMatchObject({ foreignKey: 'squad_id', canCreate: false })
  })

  test('one panel that cannot be read does not take the others with it', async () => {
    install()
    globals.SquadBadge = fakeModel({ name: 'SquadBadge', belongsTo: ['Squad'], attributes: { name: {} } }, [], { fail: true }).Model
    const panels = await relatedPanels({ hasMany: ['SquadBadge', 'SquadMember'] }, 'Squad', 3)
    expect(panels.map(panel => panel.title)).toEqual(['Squad Members'])
  })

  test('the endpoint answers for a record that exists, and says so when it does not', async () => {
    install()
    globals.Squad = fakeModel({ name: 'Squad', hasMany: ['SquadMember'], attributes: { name: {} } }, [{ id: 3, name: 'Red' }]).Model
    const ask = async (params: Record<string, string>) => {
      const result = await ModelRelatedAction.handle({ getParam: (key: string) => params[key] } as any)
      return result instanceof Response ? { status: result.status, body: await result.json() } : { status: 200, body: result as any }
    }
    const found = await ask({ slug: 'squad', id: '3' })
    expect(found.status).toBe(200)
    expect(found.body.panels.map((panel: any) => [panel.title, panel.total])).toEqual([['Squad Members', 7]])
    expect((await ask({ slug: 'squad', id: '404' })).status).toBe(404)
    expect((await ask({ slug: 'squad', id: 'abc' })).status).toBe(400)
    expect((await ask({ slug: 'no-such-model', id: '1' })).status).toBe(404)
  })
})
