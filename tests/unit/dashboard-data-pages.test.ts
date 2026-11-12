import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { statsOnly } from '../../storage/framework/defaults/app/Actions/Dashboard/Data/data-records'
import { MODEL_BADGE_COLUMNS, modelBadgeTone, modelCellDisplay } from '../../storage/framework/defaults/functions/dashboard-model-format'
import { DASHBOARD_LOADER_DELAY, dashboardLoaderTimer, dashboardReloadingClass } from '../../storage/framework/defaults/functions/dashboard-loading'
import { modelNameFromSlug, modelRecordSections } from '../../storage/framework/defaults/functions/dashboard-model-record'

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

describe('while a page is being asked for', () => {
  const models = `${components}/Models`
  const list = read(`${models}/ModelRecordsDashboard.stx`)
  const script = list.slice(0, list.indexOf('</script>'))
  const template = list.slice(list.indexOf('</script>'))
  const hosted = read(`${components}/Data/DataModelRecords.stx`)
  const loader = read(`${components}/UI/QuietLoader.stx`)
  const pages = ['ModelRecordsDashboard', 'ModelRecordDetail', 'ModelRecordEdit', 'ModelRecordCreate', 'ModelsOverview']

  it('there is no skeleton on any of the model pages', () => {
    // The list's placeholder rows were a lone bar each under "Actions", over a
    // footer that said "No records"; the overview's were six grey blocks.
    for (const page of [...pages, 'ModelRelatedPanels'])
      expect(read(`${models}/${page}.stx`)).not.toMatch(/animate-pulse|skeleton/i)
    expect(hosted).not.toContain('animate-pulse')
    expect(hosted).not.toContain(':loading=')
    expect(loader).not.toContain('animate-pulse')
  })

  it('a page says it is loading only when that takes long enough to notice', async () => {
    expect(DASHBOARD_LOADER_DELAY).toBe(250)
    const said: boolean[] = []
    const slow = { set: (value: boolean) => { said.push(value) } }
    // Answered before the wait is up: nothing was ever said.
    const quick = dashboardLoaderTimer(slow, 30)
    await Bun.sleep(5)
    quick()
    await Bun.sleep(45)
    expect(said).toEqual([false])
    // Still waiting when it is up: said, and unsaid when the answer comes.
    said.length = 0
    const long = dashboardLoaderTimer(slow, 10)
    await Bun.sleep(40)
    expect(said).toEqual([true])
    long()
    expect(said).toEqual([true, false])
  })

  it('every one of them waits through the one timer, and ends the wait whether it is answered or refused', () => {
    for (const page of pages) {
      const source = read(`${models}/${page}.stx`)
      expect(source).toContain('const slow = state(false)')
      expect(source).toContain('const settle = dashboardLoaderTimer(slow)')
      expect(source).toMatch(/finally \{\n {4}settle\(\)\n {4}loading\.set\(false\)/)
      // Never its own timer, and never an unconditional spinner.
      expect(source).not.toContain('setTimeout(')
      expect(source.slice(source.indexOf('</script>'))).toContain(':slow="slow()"')
    }
  })

  it('before a first answer it is one quiet panel, which says nothing until it is slow', () => {
    expect(loader).toContain('<div role="status" aria-live="polite" data-quiet-loader :class="panelClass()">')
    expect(loader).toContain('<p :if="slow()"')
    expect(loader).toContain('<span :text="label()"></span>')
    expect(template).toContain('<QuietLoader :if="!loaded()" :slow="slow()" :label="loadingLabel()" />')
    expect(read(`${models}/ModelRecordDetail.stx`)).toContain('<QuietLoader :if="loading() && !record()" :slow="slow()" label="Loading record" />')
    expect(read(`${models}/ModelRecordEdit.stx`)).toContain('<QuietLoader :if="loading()" :slow="slow()" label="Loading record" />')
    expect(read(`${models}/ModelRecordCreate.stx`)).toContain('<QuietLoader :if="loading()" :slow="slow()" label="Loading form" />')
    expect(read(`${models}/ModelsOverview.stx`)).toContain('<QuietLoader :if="loading() && !known()" :slow="slow()" label="Loading models" :framed="false" />')
  })

  it('the list draws no table, footer, count or empty state before its first answer', () => {
    expect(script).toContain('const loaded = state(false)')
    expect(template).toContain('<div :if="loaded() && !error() && migrated() && rows().length > 0"')
    expect(script).toContain('const isEmpty = derived(() => loaded() && !error() && migrated() && rows().length === 0)')
    expect(script).toMatch(/if \(!loaded\(\)\)\n {4}return description\(\)/)
    expect(script).toMatch(/settle\(\)\n {4}loading\.set\(false\)\n {4}loaded\.set\(true\)/)
  })

  it('asked again, what is on the page stays, dimmed, until the answer swaps it', () => {
    expect(dashboardReloadingClass(true, 'grid')).toBe('grid opacity-50 pointer-events-none transition-opacity duration-150')
    expect(dashboardReloadingClass(false, 'grid')).toBe('grid transition-opacity duration-150')
    expect(dashboardReloadingClass(true)).toBe('opacity-50 pointer-events-none transition-opacity duration-150')
    // The list: one body, never hidden, so nothing collapses on a keystroke.
    expect((template.match(/<tbody/g) || []).length).toBe(1)
    expect(template).toContain('<tbody :class="bodyClass()" :aria-busy="loading() ? \'true\' : null">')
    expect(script).toContain('const bodyClass = derived(() => dashboardReloadingClass(loading(), \'divide-black/5 divide-y dark:divide-white/8\'))')
    // The record, read again after one of its actions: its cards and its
    // panels stay where they are.
    const record = read(`${models}/ModelRecordDetail.stx`)
    expect(record).toContain('<div :if="record()" :class="contentClass()" :aria-busy="loading() ? \'true\' : null" data-record-content>')
    expect(record).toContain(':if="record() && related().length > 0"')
    const load = record.slice(record.indexOf('async function loadRecord()'), record.indexOf('function reloadRelated'))
    expect(load.slice(0, load.indexOf('catch'))).not.toContain('related.set([])')
    // The overview, refreshed.
    const overview = read(`${models}/ModelsOverview.stx`)
    expect(overview).toContain('<div :if="known() && visibleModelCount() > 0" :class="groupsClass()" :aria-busy="loading() ? \'true\' : null" data-model-groups>')
    expect(overview).toContain('<Button variant="secondary" :loading="refreshing()" :disabled="loading()" @click="loadModels">')
  })

  it('a number is not given until it is known: a 0 is a count', () => {
    expect(hosted).toContain('const pageStats = state<DataStats | null>(null)')
    expect(hosted).toContain('return numbers ? Number(numbers[key] || 0).toLocaleString() : \'-\'')
    const overview = read(`${models}/ModelsOverview.stx`)
    expect(overview).toContain('return known() ? value.toLocaleString() : \'-\'')
    expect((overview.match(/\{\{ registryCount\(/g) || []).length).toBe(3)
    // Nor a count of matches, nor "no models", while it is still asking or after it failed.
    expect(overview).toContain('const matchingLabel = derived(() => known() ? `${visibleModelCount()} matching ${visibleModelCount() === 1 ? \'model\' : \'models\'}` : \'\')')
    expect(overview).toContain('<div :if="known() && visibleModelCount() === 0">')
    expect(overview).toMatch(/catch \(error\) \{\n {4}known\.set\(false\)/)
  })

  it('a heading does not change when the answer comes', () => {
    expect(modelNameFromSlug('user')).toBe('User')
    expect(modelNameFromSlug('social-post')).toBe('Social Post')
    expect(modelNameFromSlug('')).toBe('Record')
    for (const page of ['ModelRecordDetail', 'ModelRecordEdit'])
      expect(read(`${models}/${page}.stx`)).toContain('const modelName = derived(() => record()?.modelName || modelNameFromSlug(slug()))')
    expect(read(`${models}/ModelRecordCreate.stx`)).toContain('const modelName = derived(() => form()?.modelName || modelNameFromSlug(slug()))')
    // The list's search box is worded once, from the page's heading.
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
