import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { schema } from '@stacksjs/validation'
import { loadModelRegistry } from '../../storage/framework/core/orm/src/model-registry'
import { applyModelFilters, modelFilters, modelSortableColumns, parseFilters, withStoredChoices } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-filters'
import { modelSchemaColumns } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'
import { modelFilterChosen, modelFilterDays, modelFilterIsSet, modelFilterPresetDays, modelFilterRange, modelFiltersSet, modelFilterSummary, modelFilterToggle, modelFilterValue, modelListAddress } from '../../storage/framework/defaults/functions/dashboard-model-filters'
import { modelListFilters } from '../../storage/framework/defaults/functions/dashboard-model-record'

/**
 * A list's filters and sort are derived from the model's fields
 * (stacksjs/stacks#3296).
 *
 * The Filter button opened a row of text boxes, one per column, each an
 * exact match: "act" under Status found nothing. Nothing declares a filter,
 * and nothing has to. A model already says what its fields are, which fields
 * its results are narrowed by, and which are private, and that decides which
 * filters a list offers and how each is asked for.
 */
const order = {
  name: 'Order',
  table: 'orders',
  traits: { useTimestamps: true, useSearch: { filterable: ['status', 'total', 'source'] } },
  belongsTo: ['Customer'],
  attributes: {
    reference: { fillable: true, validation: { rule: schema.string() } },
    status: { fillable: true, validation: { rule: schema.enum(['pending', 'paid', 'in_transit']) } },
    isGift: { fillable: true, validation: { rule: schema.boolean() } },
    total: { fillable: true, validation: { rule: schema.number() } },
    itemCount: { fillable: true, validation: { rule: schema.number() } },
    source: { fillable: true, validation: { rule: schema.string() } },
    notes: { fillable: true, type: 'text', validation: { rule: schema.string() } },
    payload: { fillable: true, validation: { rule: schema.json() } },
    shippedAt: { fillable: true, validation: { rule: schema.timestamp() } },
    dueOn: { fillable: true, validation: { rule: schema.date() } },
  },
}
const columns = modelSchemaColumns(order)
const kinds = (model: unknown, allowed = columns) => modelFilters(model, allowed).filters.map(filter => `${filter.name}:${filter.kind}`)

describe('which filters a list offers', () => {
  it('follows what each field is, and puts the ones the model names first', () => {
    expect(kinds(order)).toEqual([
      // Named in useSearch.filterable, in its order. A number and a line of
      // text are only filters because they are named.
      'status:choice', 'total:number', 'source:text',
      // Then what a record is, what it points at, and when things happened.
      'is_gift:boolean', 'customer_id:relation', 'due_on:date', 'shipped_at:datetime', 'created_at:datetime', 'updated_at:datetime',
    ])
    const { filters } = modelFilters(order, columns)
    expect(filters[0]).toEqual({ name: 'status', label: 'Status', kind: 'choice', options: [{ value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }, { value: 'in_transit', label: 'In Transit' }] })
    expect(filters.find(filter => filter.name === 'customer_id')).toEqual({ name: 'customer_id', label: 'Customer', kind: 'relation', relation: { slug: 'customer', label: 'Customer' } })
  })

  it('never offers free text, prose, a structure, or a number nobody named', () => {
    const offered = kinds(order).map(kind => kind.split(':')[0])
    for (const column of ['reference', 'notes', 'payload', 'item_count', 'id'])
      expect(offered, column).not.toContain(column)
  })

  it('never offers a column the page is not sent', () => {
    // The list endpoint leaves hidden columns out of what it allows. A
    // filter on one would be a way to read it.
    const visible = columns.filter(column => column !== 'status' && column !== 'customer_id')
    expect(kinds(order, visible).map(kind => kind.split(':')[0])).not.toContain('status')
    expect(kinds(order, visible).map(kind => kind.split(':')[0])).not.toContain('customer_id')
  })

  it('a model with nothing to narrow by offers nothing', () => {
    expect(kinds({ name: 'Note', traits: { useTimestamps: false }, attributes: { body: { validation: { rule: schema.string() } } } }, ['id', 'body'])).toEqual([])
  })

  it('dashboard.filters names and orders them instead, as dashboard.columns names columns', () => {
    const chosen = { ...order, dashboard: { filters: ['customer', 'isGift', 'itemCount', 'created_at'] } }
    // A belongsTo by its name, an attribute by its name, a column by its name,
    // and a number that is a filter because it was asked for.
    expect(kinds(chosen)).toEqual(['customer_id:relation', 'is_gift:boolean', 'item_count:number', 'created_at:datetime'])
    expect(modelFilters(chosen, columns).problems).toEqual([])
    // An empty list is a decision: this list has no filters.
    expect(kinds({ ...order, dashboard: { filters: [] } })).toEqual([])
  })

  it('says which declared name it could not use, and why', () => {
    const { filters, problems } = modelFilters({ ...order, dashboard: { filters: ['status', 'statsu', 'notes', 3, 'status'] } }, columns)
    expect(filters.map(filter => filter.name)).toEqual(['status'])
    expect(problems).toEqual([
      '\'statsu\' is not a field the list has',
      '\'notes\' is prose or a structure, which a list is searched for and not filtered by',
      'an entry is not a field name',
    ])
  })

  it('every shipped model\'s list gets filters it can draw, and none is misdeclared', async () => {
    const models = await loadModelRegistry({
      defaultsRoot: resolve('storage/framework/defaults/app/Models'),
      userRoot: join(tmpdir(), 'stacks-no-user-models'),
    }) as Record<string, any>
    let offered = 0
    let withNone = 0
    for (const [name, model] of Object.entries(models)) {
      const { filters, problems } = modelFilters(model, modelSchemaColumns(model))
      expect(problems, name).toEqual([])
      if (filters.length === 0)
        withNone++
      offered += filters.length
      for (const filter of filters) {
        expect(filter.label, `${name}.${filter.name}`).toBeTruthy()
        if (filter.kind === 'choice')
          expect(filter.options!.length, `${name}.${filter.name}`).toBeGreaterThan(0)
        if (filter.kind === 'relation')
          expect(filter.relation!.slug, `${name}.${filter.name}`).toMatch(/^[a-z][a-z0-9-]*$/)
      }
      // No model has to declare them: none of the shipped ones does.
      expect(model?.dashboard?.filters, name).toBeUndefined()
    }
    expect(Object.keys(models).length).toBeGreaterThan(100)
    expect(offered).toBeGreaterThan(300)
    // A model with timestamps always has when it was created to narrow by.
    expect(withNone).toBeLessThan(10)
  })
})

describe('a field of text the model named', () => {
  const text = [{ name: 'status', label: 'Status', kind: 'text' as const }, { name: 'is_gift', label: 'Gift', kind: 'boolean' as const }]

  it('is chosen from the values the table holds, when there are few', async () => {
    const asked: string[] = []
    const read = async (table: string, column: string, limit: number) => (asked.push(`${table}.${column}:${limit}`), ['inactive', 'active', null, '', 'active'])
    const filters = await withStoredChoices('teams_a', text, read, 1_000)
    expect(filters[0]).toEqual({ name: 'status', label: 'Status', kind: 'choice', open: true, options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] })
    // Only text is looked up: a yes-or-no already knows its answers.
    expect(filters[1]).toEqual(text[1]!)
    expect(asked).toEqual(['teams_a.status:21'])
  })

  it('stays a box when there are too many values to choose from, or none', async () => {
    const many = Array.from({ length: 21 }, (_, index) => `source-${index}`)
    expect((await withStoredChoices('teams_b', text, async () => many, 1_000))[0]!.kind).toBe('text')
    expect((await withStoredChoices('teams_c', text, async () => [null, ''], 1_000))[0]!.kind).toBe('text')
    // And when the table cannot be read: it is still a filter.
    expect((await withStoredChoices('teams_d', text, async () => { throw new Error('no such table') }, 1_000))[0]!.kind).toBe('text')
  })

  it('reads the table once for half a minute, not on every page and keystroke', async () => {
    let reads = 0
    const read = async () => (reads++, ['active'])
    await withStoredChoices('teams_e', text, read, 1_000)
    await withStoredChoices('teams_e', text, read, 20_000)
    expect(reads).toBe(1)
    await withStoredChoices('teams_e', text, read, 31_001)
    expect(reads).toBe(2)
    // Another table's column of the same name is its own.
    await withStoredChoices('teams_f', text, read, 31_001)
    expect(reads).toBe(3)
  })
})

describe('what a filter may carry', () => {
  it('a value, any of several, a range of days, a range of numbers', () => {
    expect(parseFilters('{"status":"active","count":2,"enabled":true}')).toEqual({ status: 'active', count: '2', enabled: 'true' })
    expect(parseFilters('{"status":{"in":["paid","pending","paid",""]}}')).toEqual({ status: { in: ['paid', 'pending'] } })
    expect(parseFilters('{"created_at":{"from":"2026-01-01T00:00:00.000Z","to":"2026-02-01T00:00:00.000Z"}}')).toEqual({ created_at: { from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z' } })
    expect(parseFilters('{"total":{"min":10,"max":"99.5"}}')).toEqual({ total: { min: 10, max: 99.5 } })
    expect(parseFilters('{"total":{"min":0}}')).toEqual({ total: { min: 0 } })
  })

  it('an empty one narrows nothing and is dropped', () => {
    expect(parseFilters('{"a":"","b":null,"c":{"in":[]},"d":{"from":"","to":null},"e":{"min":""}}')).toEqual({})
    expect(parseFilters(null)).toEqual({})
  })

  it('anything else is refused, by name', () => {
    expect(() => parseFilters('{')).toThrow('Could not parse model filters')
    expect(() => parseFilters('[]')).toThrow('Model filters must be a JSON object')
    expect(() => parseFilters('{"bad-column":"active"}')).toThrow('Invalid model filter column "bad-column"')
    expect(() => parseFilters('{"status":{"like":"%"}}')).toThrow('Model filter "status" is not a comparison the list has')
    expect(() => parseFilters('{"status":{"in":"paid"}}')).toThrow('Model filter "status" must list the values to match')
    expect(() => parseFilters('{"status":{"in":[{"$ne":1}]}}')).toThrow('must list the values to match')
    expect(() => parseFilters(`{"status":{"in":${JSON.stringify(Array.from({ length: 51 }, (_, index) => String(index)))}}}`)).toThrow('may list at most 50 values')
    expect(() => parseFilters('{"total":{"min":"ten"}}')).toThrow('Model filter "total" min must be a number')
    expect(() => parseFilters('{"created_at":{"from":5}}')).toThrow('Model filter "created_at" from must be a date')
    expect(() => parseFilters('{"status":["paid"]}')).toThrow('must be a value, or an object saying how to compare')
    // Two comparisons at once are not one.
    expect(() => parseFilters('{"total":{"min":1,"in":["2"]}}')).toThrow('is not a comparison the list has')
  })
})

describe('how a filter narrows the query', () => {
  /** A query that only remembers what it was asked. */
  function recorder() {
    const calls: unknown[][] = []
    const query = {
      calls,
      where: (...args: unknown[]) => (calls.push(['where', ...args]), query),
      whereIn: (...args: unknown[]) => (calls.push(['whereIn', ...args]), query),
    }
    return query
  }
  const { filters } = modelFilters(order, columns)
  const apply = (values: string) => {
    const query = recorder()
    const { error } = applyModelFilters(query, parseFilters(values), filters, column => `the ${column} column`)
    return { calls: query.calls, error }
  }

  it('each kind as the database is asked', () => {
    expect(apply('{"status":{"in":["paid","pending"]}}').calls).toEqual([['whereIn', 'status', ['paid', 'pending']]])
    expect(apply('{"status":"paid"}').calls).toEqual([['where', 'status', 'paid']])
    expect(apply('{"is_gift":"true"}').calls).toEqual([['where', 'is_gift', true]])
    expect(apply('{"is_gift":"no"}').calls).toEqual([['where', 'is_gift', false]])
    expect(apply('{"customer_id":{"in":["3","7"]}}').calls).toEqual([['whereIn', 'customer_id', ['3', '7']]])
    expect(apply('{"total":{"min":10,"max":99.5}}').calls).toEqual([['where', 'total', '>=', 10], ['where', 'total', '<=', 99.5]])
    // A day column: the days as they are, both included.
    expect(apply('{"due_on":{"from":"2026-01-01","to":"2026-01-31"}}').calls).toEqual([['where', 'due_on', '>=', '2026-01-01'], ['where', 'due_on', '<=', '2026-01-31']])
    // A moment: as the database stores one, and the end is not included.
    expect(apply('{"shipped_at":{"from":"2026-01-01T08:00:00.000Z","to":"2026-02-01T08:00:00.000Z"}}').calls).toEqual([
      ['where', 'shipped_at', '>=', '2026-01-01T08:00:00.000'],
      ['where', 'shipped_at', '<', '2026-02-01T08:00:00.000'],
    ])
    // A column that is not a filter is still matched exactly: a record's
    // panel links to a list narrowed by it.
    expect(apply('{"reference":"A-100"}').calls).toEqual([['where', 'reference', 'A-100']])
  })

  it('a comparison that does not suit the field is refused, and nothing is asked', () => {
    const refused: Array<[string, string]> = [
      ['{"status":{"in":["shipped"]}}', 'Status cannot be "shipped".'],
      ['{"status":"shipped"}', 'Status cannot be "shipped".'],
      ['{"is_gift":"maybe"}', 'Is Gift is yes or no.'],
      ['{"status":{"min":1}}', 'Status is not a number, so it has no minimum or maximum.'],
      ['{"total":{"from":"2026-01-01"}}', 'Total is not a date, so it has no range of days.'],
      ['{"total":{"in":["1"]}}', 'Total cannot be matched against a list of values.'],
      ['{"due_on":{"from":"2026-01-01T00:00:00.000Z"}}', 'Due from must be a day, as 2026-01-31.'],
      ['{"due_on":{"to":"2026-13-45"}}', 'Due to must be a day, as 2026-01-31.'],
      ['{"shipped_at":{"from":"soon"}}', 'Shipped from must be a date and time.'],
      // Not one of the list's filters: named as the page names the column.
      ['{"reference":{"in":["A-100"]}}', 'the reference column is not one of this list\'s filters, so it can only be matched exactly.'],
      ['{"item_count":{"min":1}}', 'the item_count column is not one of this list\'s filters, so it can only be matched exactly.'],
    ]
    for (const [values, message] of refused)
      expect(apply(values), values).toEqual({ calls: expect.anything(), error: message })
    // The first refusal stops it: what came before is not left half applied on the caller's query.
    const query = recorder()
    const result = applyModelFilters(query, parseFilters('{"status":"paid","total":{"in":["1"]}}'), filters)
    expect(result.error).toBe('Total cannot be matched against a list of values.')
    expect(result.query).toBe(query)
  })

  it('a choice read from the table does not refuse a value that is gone', () => {
    const open = [{ name: 'status', label: 'Status', kind: 'choice' as const, open: true, options: [{ value: 'active', label: 'Active' }] }]
    const query = recorder()
    expect(applyModelFilters(query, { status: { in: ['retired'] } }, open).error).toBeNull()
    expect(query.calls).toEqual([['whereIn', 'status', ['retired']]])
  })
})

describe('what a list is ordered by', () => {
  it('any stored value, but not prose, a structure, or another record\'s id', () => {
    const sortable = modelSortableColumns(order, columns)
    for (const column of ['id', 'reference', 'status', 'is_gift', 'total', 'item_count', 'shipped_at', 'due_on', 'created_at', 'updated_at'])
      expect(sortable, column).toContain(column)
    // The cell shows the customer's name; ordering by its id would look random.
    expect(sortable).not.toContain('customer_id')
    expect(sortable).not.toContain('notes')
    expect(sortable).not.toContain('payload')
    // And only what the page is sent.
    expect(modelSortableColumns(order, ['id', 'reference'])).toEqual(['id', 'reference'])
  })
})

describe('a filter\'s value on the page', () => {
  it('is read from an address only in the shapes a filter has', () => {
    expect(modelListFilters('{"team_id":"3","status":{"in":["active","pending"]},"total":{"min":5},"created_at":{"from":"2026-01-01T00:00:00.000Z"}}')).toEqual({
      team_id: '3',
      status: { in: ['active', 'pending'] },
      total: { min: 5 },
      created_at: { from: '2026-01-01T00:00:00.000Z' },
    })
    for (const bad of ['{"status":{"like":"%"}}', '{"status":{"in":[]}}', '{"status":{"in":[{"a":1}]}}', '{"total":{"min":"ten"}}', '{"a b":{"in":["1"]}}', '{"status":true}'])
      expect(modelListFilters(bad), bad).toEqual({})
    expect(modelFilterValue({ min: 1, in: ['2'] })).toBeNull()
  })

  it('a filter that is empty narrows nothing', () => {
    expect(modelFilterIsSet('')).toBe(false)
    expect(modelFilterIsSet(undefined)).toBe(false)
    expect(modelFilterIsSet({ in: [] })).toBe(false)
    expect(modelFilterIsSet({ from: '', to: '' })).toBe(false)
    expect(modelFilterIsSet({ min: 0 })).toBe(true)
    expect(modelFilterIsSet('0')).toBe(true)
    expect(modelFiltersSet({ a: '', b: { in: [] }, c: 'x', d: { in: ['1'] } })).toEqual({ c: 'x', d: { in: ['1'] } })
  })

  it('picking and unpicking a value', () => {
    expect(modelFilterToggle(undefined, 'paid')).toEqual({ in: ['paid'] })
    expect(modelFilterToggle({ in: ['paid'] }, 'pending')).toEqual({ in: ['paid', 'pending'] })
    expect(modelFilterToggle({ in: ['paid', 'pending'] }, 'paid')).toEqual({ in: ['pending'] })
    // Unpicking the last one clears the filter.
    expect(modelFilterToggle({ in: ['paid'] }, 'paid')).toBe('')
    // An exact value from a link counts as picked.
    expect(modelFilterChosen('paid')).toEqual(['paid'])
    expect(modelFilterToggle('paid', 'pending')).toEqual({ in: ['paid', 'pending'] })
  })

  it('a range of days is the viewer\'s days', () => {
    // A day column carries the days as they are.
    expect(modelFilterRange('date', '2026-01-05', '2026-01-07')).toEqual({ from: '2026-01-05', to: '2026-01-07' })
    expect(modelFilterRange('date', '2026-01-05', '')).toEqual({ from: '2026-01-05' })
    // A moment carries where the first day starts and where the day after
    // the last one does, wherever the viewer is.
    const range = modelFilterRange('datetime', '2026-01-05', '2026-01-07') as { from: string, to: string }
    expect(new Date(range.from).getTime()).toBe(new Date(2026, 0, 5).getTime())
    expect(new Date(range.to).getTime()).toBe(new Date(2026, 0, 8).getTime())
    // And reads back as the days that were picked.
    expect(modelFilterDays('datetime', range)).toEqual({ from: '2026-01-05', to: '2026-01-07' })
    expect(modelFilterDays('date', { from: '2026-01-05' })).toEqual({ from: '2026-01-05', to: '' })
    // Not a day: nothing.
    expect(modelFilterRange('datetime', '2026-02-30', 'soon')).toBe('')
    expect(modelFilterDays('datetime', 'paid')).toEqual({ from: '', to: '' })
  })

  it('the ranges offered in one press', () => {
    const now = new Date(2026, 2, 18, 15, 30)
    expect(modelFilterPresetDays('today', now)).toEqual({ from: '2026-03-18', to: '2026-03-18' })
    expect(modelFilterPresetDays('week', now)).toEqual({ from: '2026-03-12', to: '2026-03-18' })
    expect(modelFilterPresetDays('month', now)).toEqual({ from: '2026-03-01', to: '2026-03-18' })
    // Across a month's start.
    expect(modelFilterPresetDays('week', new Date(2026, 2, 3))).toEqual({ from: '2026-02-25', to: '2026-03-03' })
  })

  it('is worded in its chip', () => {
    const status = { name: 'status', label: 'Status', kind: 'choice' as const, options: [{ value: 'in_transit', label: 'In Transit' }, { value: 'paid', label: 'Paid' }] }
    expect(modelFilterSummary(status, { in: ['paid', 'in_transit'] })).toBe('Paid, In Transit')
    expect(modelFilterSummary(status, 'paid')).toBe('Paid')
    expect(modelFilterSummary({ name: 'is_gift', label: 'Gift', kind: 'boolean' }, 'true')).toBe('Yes')
    expect(modelFilterSummary({ name: 'is_gift', label: 'Gift', kind: 'boolean' }, 'false')).toBe('No')
    const team = { name: 'team_id', label: 'Team', kind: 'relation' as const, relation: { slug: 'team', label: 'Team' } }
    expect(modelFilterSummary(team, { in: ['3', '9'] }, { 3: 'Northwind' })).toBe('Northwind, #9')
    expect(modelFilterSummary({ name: 'total', label: 'Total', kind: 'number' }, { min: 1000 })).toBe('at least 1,000')
    expect(modelFilterSummary({ name: 'total', label: 'Total', kind: 'number' }, { max: 50 })).toBe('at most 50')
    expect(modelFilterSummary({ name: 'total', label: 'Total', kind: 'number' }, { min: 10, max: 50 })).toBe('10 to 50')
    const created = { name: 'created_at', label: 'Created', kind: 'datetime' as const }
    expect(modelFilterSummary(created, modelFilterRange('datetime', '2026-01-05', '2026-01-07'))).toMatch(/^.*5.* to .*7.*$/)
    expect(modelFilterSummary(created, modelFilterRange('datetime', '2026-01-05', '2026-01-05'))).not.toContain(' to ')
    expect(modelFilterSummary(created, modelFilterRange('datetime', '2026-01-05', ''))).toMatch(/^from /)
    expect(modelFilterSummary(created, modelFilterRange('datetime', '', '2026-01-05'))).toMatch(/^until /)
    // A column the list does not offer as a filter: the value as it is, or the record's name.
    expect(modelFilterSummary(undefined, '3', { 3: 'Northwind' })).toBe('Northwind')
    expect(modelFilterSummary(undefined, 'A-100')).toBe('A-100')
  })

  it('is written to the list\'s address', () => {
    expect(modelListAddress('/models/order', '', {})).toBe('/models/order')
    expect(modelListAddress('/models/order', ' ava ', { status: { in: ['paid'] }, total: '' })).toBe(`/models/order?q=ava&filters=${encodeURIComponent('{"status":{"in":["paid"]}}')}`)
    // And read back as it was.
    const address = modelListAddress('/data/teams', '', { status: { in: ['active'] }, created_at: { from: '2026-01-01T00:00:00.000Z' } })
    expect(modelListFilters(new URL(address, 'http://dashboard.test').searchParams.get('filters'))).toEqual({ status: { in: ['active'] }, created_at: { from: '2026-01-01T00:00:00.000Z' } })
  })
})

describe('the list page', () => {
  const components = 'storage/framework/defaults/resources/components/Dashboard/Models'
  const list = readFileSync(`${components}/ModelRecordsDashboard.stx`, 'utf8')
  const panel = readFileSync(`${components}/ModelFilterPanel.stx`, 'utf8')

  it('asks through the panel, not a row of text boxes under the headings', () => {
    expect((list.match(/<tr\b/g) || []).length).toBe(2)
    expect(list).not.toContain('onFilterInput')
    expect(list).toContain('<ModelFilterPanel\n    :if="migrated() && showFilters() && filterable().length > 0"')
    expect(list).toContain('filterable.set(data.filterable ?? [])')
    // The button is there when there is something to narrow by, or something narrowing.
    expect(list).toContain(':if="migrated() && (filterable().length > 0 || activeFilterCount() > 0)"')
    // One control for each kind the server can name.
    for (const kind of ['choice', 'boolean', 'relation', 'number', 'text'])
      expect(panel, kind).toContain(`filter.kind === '${kind}'`)
    expect(panel).toContain('filter.kind === \'date\' || filter.kind === \'datetime\'')
    expect(panel).toContain('<ModelRelationPicker')
    // It holds no value of its own: what it shows is what the list holds.
    expect(panel).not.toMatch(/= state\(/)
  })

  it('always shows what is narrowing it, and writes it to the address', () => {
    expect(list).toContain('<div :if="filterChips().length > 0" data-filter-chips')
    expect(list).toContain('@click="clearFilter(chip.column)"')
    expect(list).toContain('text: modelFilterSummary(filter, value, relationNames()[column] ?? {})')
    expect(list).toContain('navigation.replacePath(modelListAddress(navigation.path(), search(), active))')
  })

  it('makes a heading a sort button only where the list can be ordered by it', () => {
    expect(list).toContain('<button :if="canSort(column)" type="button" @click="toggleSort(column)"')
    expect(list).toContain('<span :if="!canSort(column)" :class="plainHeaderClass(column)">')
    expect(list).toContain('return sortable().includes(column.name)')
    expect(list).toContain('if (!canSort(column)) return')
  })
})

describe('through the list endpoint, against a real database', () => {
  it('each list offers its filters and each comparison finds its rows', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stacks-model-filters-'))
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/model-filters.ts`], {
        env: { ...process.env, APP_ENV: 'test', MAIL_MAILER: 'log', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'app.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 50_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('model filters OK')
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
