import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { statsOnly } from '../../storage/framework/defaults/app/Actions/Dashboard/Data/data-records'
import { MODEL_BADGE_COLUMNS, modelBadgeTone, modelCellDisplay } from '../../storage/framework/defaults/functions/dashboard-model-format'
import { modelRecordSections } from '../../storage/framework/defaults/functions/dashboard-model-record'

/**
 * The Users, Teams and Subscribers pages are the model's own list
 * (stacksjs/stacks#3277).
 *
 * Each was a second, hand-built list of a model that already had one. The
 * two drifted: row actions, selection, bulk actions, action forms, column
 * choice and filters were built on the generic list and missing where the
 * sidebar leads, and the hand-built pages only ever read the newest hundred
 * rows. The pages now host the one list under their own title and stats.
 */
const components = 'storage/framework/defaults/resources/components/Dashboard'
const read = (path: string) => readFileSync(path, 'utf8')

describe('a page hosts the model\'s list', () => {
  const list = read(`${components}/Models/ModelRecordsDashboard.stx`)
  const hosted = read(`${components}/Data/DataModelRecords.stx`)

  it('each of the three views is the hosting page and nothing else', () => {
    for (const page of ['users', 'teams', 'subscribers']) {
      const view = read(`storage/framework/defaults/views/dashboard/data/${page}.stx`)
      expect(view).toContain(`<DataModelRecords mode="${page}" />`)
      // The list pads itself; a second gutter around it would double it.
      expect(view).not.toContain('<PageLayout')
    }
    // The second list is gone, not kept beside the first.
    expect(() => read(`${components}/Data/DataRecords.stx`)).toThrow()
  })

  it('the list can be told which model, what the page is called and where it lives', () => {
    expect(list).toContain('const hostedModel = useReactiveProp(\'model\', \'\')')
    expect(list).toContain('const slug = derived(() => hostedModel() || navigation.urlSegment(-1) || \'\')')
    expect(list).toContain('const title = derived(() => heading() || modelName())')
    expect(list).toContain('return description() || `${recordLabel()} in the ${tableName()} table`')
    expect(hosted).toContain(':model="recordsPage().model"')
    expect(hosted).toContain(':heading="recordsPage().title"')
    expect(hosted).toContain(':description="recordsPage().description"')
  })

  it('it loads once it is mounted: a prop is not bound while it is being set up', () => {
    // Loading sooner asked for a model named by the last part of the host's
    // own address: "No ORM model named Users".
    const script = list.slice(0, list.indexOf('</script>'))
    expect(script).toMatch(/onMount\(\(\) => \{\n {2}void load\(\)\n\}\)\n$/)
    expect(script).not.toMatch(/\nvoid load\(\)\n/)
  })

  it('the page puts its stats above the table, and reads them again when a record changes', () => {
    expect(list).toContain('<slot name="summary" />')
    expect(hosted).toContain('<template #summary>')
    expect(hosted).toContain('@changed="loadPageStats"')
    // After a delete, a bulk run that did something, and one of the model's actions.
    expect((list.match(/emit\('changed'\)/g) || []).length).toBe(3)
    expect(hosted).toContain('pageStats.set(await fetchDashboardStats(pageMode()))')
    expect(read('storage/framework/defaults/functions/data.ts')).toContain('`${endpointByMode[mode]}?only=stats`')
  })

  it('nothing the page puts in the list\'s slot is named as the list names its own', () => {
    // What goes in the slot is read against the list's names first: a `page`
    // here was the list's page number, and the first card said "Total undefined".
    const script = hosted.slice(0, hosted.indexOf('</script>'))
    const template = hosted.slice(hosted.indexOf('</script>'))
    const mine = [...script.matchAll(/^(?:const|function|async function) (\w+)/gm)].map(match => match[1]!)
    const theirs = new Set([...list.slice(0, list.indexOf('</script>')).matchAll(/^(?:const|function|async function|let) (\w+)/gm)].map(match => match[1]!))
    expect(mine.length).toBeGreaterThan(4)
    expect(mine.filter(name => theirs.has(name))).toEqual([])
    expect(template).not.toMatch(/\bpage\(\)|\bstats\(\)|\bmode\(\)/)
  })

  it('the three endpoints can be asked for the numbers alone', () => {
    for (const name of ['User', 'Team', 'Subscriber']) {
      const action = read(`storage/framework/defaults/app/Actions/Dashboard/Data/${name}IndexAction.ts`)
      expect(action).toContain(`const rows = statsOnly(request) ? [] : await ${name}.orderByDesc('created_at').limit(100).get()`)
    }
    expect(statsOnly({ get: (key: string) => (key === 'only' ? 'stats' : undefined) })).toBe(true)
    expect(statsOnly({ get: () => undefined })).toBe(false)
    expect(statsOnly({ get: (key: string) => (key === 'only' ? 'rows' : undefined) })).toBe(false)
    // Called without a request, as a test or a job might: the rows come.
    expect(statsOnly(undefined)).toBe(false)
    expect(statsOnly({})).toBe(false)
  })

  it('the Activity log is not a list of editable records, and is left as its own page', () => {
    const view = read('storage/framework/defaults/views/dashboard/data/activity/index.stx')
    expect(view).toContain('<ActivityLog />')
    const log = read(`${components}/Data/ActivityLog.stx`)
    expect(log).toContain('fetchDashboardData<DashboardActivity>(\'activity\')')
    // It knows one model, and none of the three it used to share a file with.
    expect(log).not.toMatch(/'users'|'teams'|'subscribers'/)
  })
})

describe('while a list is being asked for', () => {
  const list = read(`${components}/Models/ModelRecordsDashboard.stx`)
  const script = list.slice(0, list.indexOf('</script>'))
  const template = list.slice(list.indexOf('</script>'))
  const hosted = read(`${components}/Data/DataModelRecords.stx`)

  it('there is no skeleton: not in the table, not in the page\'s cards', () => {
    // Before a column is known the placeholder rows were a lone bar each under
    // "Actions", over a footer that said "No records" and "1 / 1".
    expect(list).not.toContain('animate-pulse')
    expect(list).not.toMatch(/skeleton/i)
    expect(hosted).not.toContain('animate-pulse')
    expect(hosted).not.toContain(':loading=')
  })

  it('before the first answer it draws one quiet card and no table', () => {
    expect(script).toContain('const loaded = state(false)')
    expect(template).toContain('<div :if="!loaded()" role="status" aria-live="polite" data-first-load')
    // The table, its footer, the empty state and the count wait for an answer.
    expect(template).toContain('<div :if="loaded() && !error() && migrated() && rows().length > 0"')
    expect(script).toContain('const isEmpty = derived(() => loaded() && !error() && migrated() && rows().length === 0)')
    expect(script).toMatch(/if \(!loaded\(\)\)\n {4}return description\(\)/)
    expect(script).toMatch(/finally \{\n {4}clearTimeout\(waiting\)\n {4}slow\.set\(false\)\n {4}loading\.set\(false\)\n {4}loaded\.set\(true\)\n {2}\}/)
  })

  it('it says it is loading only when that takes long enough to notice', () => {
    expect(script).toContain('const SLOW_AFTER = 250')
    expect(script).toContain('const waiting = setTimeout(() => slow.set(true), SLOW_AFTER)')
    const card = template.slice(template.indexOf('data-first-load'), template.indexOf('<div :if="loaded() && !error() && migrated() && rows().length > 0"'))
    expect(card).toContain('<p :if="slow()"')
    expect(card).toContain(':text="loadingLabel()"')
  })

  it('asking again keeps the rows that are there, dimmed, until the answer swaps them', () => {
    // One body, never hidden: nothing collapses and jumps back on a keystroke.
    expect((template.match(/<tbody/g) || []).length).toBe(1)
    expect(template).toContain('<tbody :class="bodyClass()" :aria-busy="loading() ? \'true\' : null">')
    expect(script).toMatch(/const bodyClass = derived\(\(\) => loading\(\)\n {2}\? '[^']*opacity-50 pointer-events-none[^']*'/)
  })

  it('a card says nothing until its number has come: a 0 is a count', () => {
    expect(hosted).toContain('const pageStats = state<DataStats | null>(null)')
    expect(hosted).toContain('return numbers ? Number(numbers[key] || 0).toLocaleString() : \'-\'')
  })

  it('the search box is worded once, from the page\'s heading', () => {
    expect(script).toContain('const searchPlaceholder = derived(() => `Search ${(heading() || modelName() || \'records\').toLowerCase()}`)')
  })
})

describe('a status reads as one in a list', () => {
  it('a status-like column is a pill, as it is on the record\'s page', () => {
    expect(modelCellDisplay({ name: 'status' }, 'active')).toEqual({ kind: 'badge', text: 'Active', tone: 'positive' })
    expect(modelCellDisplay({ name: 'role' }, 'admin')).toEqual({ kind: 'badge', text: 'Admin', tone: 'neutral' })
    expect(MODEL_BADGE_COLUMNS.has('status')).toBe(true)
    // Not every column, and not every value in one.
    expect(modelCellDisplay({ name: 'name' }, 'active')).toBeNull()
    expect(modelCellDisplay({ name: 'status' }, null)).toBeNull()
    expect(modelCellDisplay({ name: 'status' }, '')).toBeNull()
    expect(modelCellDisplay({ name: 'status' }, 3)).toBeNull()
    expect(modelCellDisplay({ name: 'status' }, 'x'.repeat(33))).toBeNull()
  })

  it('the model\'s own say comes first', () => {
    expect(modelCellDisplay({ name: 'status', format: { format: 'text' } }, 'active')).toEqual({ kind: 'text', text: 'active' })
    expect(modelCellDisplay({ name: 'title', format: { format: 'badge' } }, 'pending')).toEqual({ kind: 'badge', text: 'Pending', tone: 'pending' })
  })

  it('coloured by what the word says, and only when it says it', () => {
    for (const word of ['active', 'Subscribed', 'PAID', 'published', 'verified'])
      expect(modelBadgeTone(word)).toBe('positive')
    for (const word of ['inactive', 'unsubscribed', 'bounced', 'failed', 'Cancelled', 'suspended'])
      expect(modelBadgeTone(word)).toBe('negative')
    for (const word of ['pending', 'draft', 'in progress', 'in-progress', 'queued'])
      expect(modelBadgeTone(word)).toBe('pending')
    // A role or a plan is a word out of a few too, and says neither.
    for (const word of ['admin', 'member', 'pro', 'email', '', null, undefined, 7])
      expect(modelBadgeTone(word)).toBe('neutral')
  })

  it('the list and the record\'s page draw the pill with one component', () => {
    const list = read(`${components}/Models/ModelRecordsDashboard.stx`)
    expect(list).toContain('<ModelBadge :if="cellKind(row, column) === \'badge\'" :text="cellValue(row, column)" :tone="cellTone(row, column)" />')
    expect(read(`${components}/Models/ModelRecordDetail.stx`)).toContain('<ModelBadge :if="detail.kind === \'badge\'" :text="detail.value" :tone="detail.tone || \'neutral\'" />')
    const sections = modelRecordSections({
      modelName: 'Team',
      row: { id: 1, status: 'inactive' },
      columns: [{ name: 'status', label: 'Status', type: 'text' }],
      updateColumns: [],
      fields: [],
      relations: {},
      relationNames: {},
      writeCapabilities: { create: false, update: false, destroy: false, invite: false, anonymize: false },
      anonymized: false,
      actions: [],
    })
    expect(sections.flatMap(section => section.details)[0]).toMatchObject({ kind: 'badge', value: 'Inactive', tone: 'negative' })
  })
})
