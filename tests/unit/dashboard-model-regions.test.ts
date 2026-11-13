import { afterAll, describe, expect, it } from 'bun:test'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderTemplate } from '@stacksjs/stx'
import type { DashboardModelOptions } from '@stacksjs/types'
import { DASHBOARD_MODEL_REGIONS, dashboardModelRegions, dashboardRegionEntries, readDashboardRegions } from '../../storage/framework/defaults/resources/functions/dashboard/regions'
import { useModelList } from '../../storage/framework/defaults/views/dashboard/composables/useModelList'
import { useModelRecord } from '../../storage/framework/defaults/views/dashboard/composables/useModelRecord'
import { modelPageStore } from '../../storage/framework/defaults/views/dashboard/stores/model-page'

/**
 * A model places a component of the app's own on its dashboard pages
 * (stacksjs/stacks#3295).
 *
 * There were two ways to change a dashboard page: say something on the
 * model's `dashboard` block that the dashboard already draws, or replace the
 * page with a file of the same name and own it from then on. To add one
 * panel to a record's page an app copied the page. A region is the step
 * between: the model names a component for a place, as it names an action
 * for a button.
 */
const NONE = { listTop: '', listBottom: '', recordTop: '', recordBottom: '' }

describe('what a model may declare', () => {
  it('a component for each of four places, by the name its file has', () => {
    expect([...DASHBOARD_MODEL_REGIONS]).toEqual(['listTop', 'listBottom', 'recordTop', 'recordBottom'])
    expect(readDashboardRegions({ recordTop: 'OrderTimeline', listBottom: 'OrderTotals' })).toEqual({
      regions: { ...NONE, recordTop: 'OrderTimeline', listBottom: 'OrderTotals' },
      problems: [],
    })
    // Nothing declared places nothing, and is not a problem.
    expect(readDashboardRegions(undefined)).toEqual({ regions: NONE, problems: [] })
    expect(readDashboardRegions({})).toEqual({ regions: NONE, problems: [] })
  })

  it('anything else is left out, and said why', () => {
    expect(readDashboardRegions({ recordTop: 'OrderTimeline', sidebar: 'Promo', listTop: 'order-totals', listBottom: 3 })).toEqual({
      regions: { ...NONE, recordTop: 'OrderTimeline' },
      problems: [
        '\'sidebar\' is not a place a component can be put: listTop, listBottom, recordTop, recordBottom',
        '\'listTop\' must name a component as its file is called, such as \'OrderTimeline\'',
        '\'listBottom\' must name a component as its file is called, such as \'OrderTimeline\'',
      ],
    })
    expect(readDashboardRegions(['OrderTimeline']).problems).toEqual(['it is not an object of places and component names'])
  })

  it('a name is only ever a component\'s: it is what the file is looked up by', () => {
    for (const name of ['../../secrets', 'Order/Timeline', 'Order.Timeline', 'order', '', ' OrderTimeline', 'Order Timeline', '<script>', 'div'])
      expect(readDashboardRegions({ recordTop: name }).regions.recordTop, JSON.stringify(name)).toBe('')
    expect(readDashboardRegions({ recordTop: 'OrderTimeline2' }).regions.recordTop).toBe('OrderTimeline2')
  })

  it('the places it reads are the places the model is typed to name', () => {
    // The compiler holds a model to these in core/types/tests/dashboard-model-types.test.ts,
    // where tsc reads the assertions. This holds the reader to the same four.
    const typed: Required<NonNullable<DashboardModelOptions['regions']>> = { listTop: 'A', listBottom: 'B', recordTop: 'C', recordBottom: 'D' }
    expect(Object.keys(typed).sort()).toEqual([...DASHBOARD_MODEL_REGIONS].sort())
    expect(readDashboardRegions(typed)).toEqual({ regions: typed, problems: [] })
  })
})

describe('what a page is told, from the model its address names', () => {
  const models = [
    { id: 'order', name: 'Order', dashboard: { regions: { recordTop: 'OrderTimeline', listTop: 'OrderTotals' } } },
    { id: 'social-post', name: 'SocialPost', dashboard: { regions: { listBottom: 'PostReach' } } },
    { id: 'user', name: 'User', dashboard: { highlight: true } },
    { id: 'coupon', name: 'Coupon', dashboard: { regions: { footer: 'Promo', recordTop: 'CouponUse' } } },
  ]

  it('the components that model places, and nothing for one that places none', () => {
    expect(dashboardModelRegions('order', models)).toEqual({ ...NONE, recordTop: 'OrderTimeline', listTop: 'OrderTotals' })
    // A model's address is its name in kebab case.
    expect(dashboardModelRegions('social-post', models)).toEqual({ ...NONE, listBottom: 'PostReach' })
    expect(dashboardModelRegions('user', models)).toEqual(NONE)
  })

  it('nothing for a model the dashboard does not know, or an address that is not one', () => {
    expect(dashboardModelRegions('invoice', models)).toEqual(NONE)
    expect(dashboardModelRegions('Order', models)).toEqual(NONE)
    expect(dashboardModelRegions(undefined, models)).toEqual(NONE)
    expect(dashboardModelRegions(['order'], models)).toEqual(NONE)
  })

  it('what it could not use is logged once per model, and the rest still placed', () => {
    const warnings: string[] = []
    const original = console.warn
    console.warn = (message: unknown) => { warnings.push(String(message)) }
    try {
      expect(dashboardModelRegions('coupon', models)).toEqual({ ...NONE, recordTop: 'CouponUse' })
      dashboardModelRegions('coupon', models)
    }
    finally {
      console.warn = original
    }
    expect(warnings).toEqual(['[dashboard] Coupon dashboard.regions: \'footer\' is not a place a component can be put: listTop, listBottom, recordTop, recordBottom. It is left out.'])
  })

  it('a page is told every component placed at a place, by the model that placed it', () => {
    // A dashboard page is one document for every address, so the server
    // cannot draw "this model's". It draws them all; the page mounts one.
    expect(dashboardRegionEntries('recordTop', models)).toEqual([
      { model: 'coupon', component: 'CouponUse' },
      { model: 'order', component: 'OrderTimeline' },
    ])
    expect(dashboardRegionEntries('listBottom', models)).toEqual([{ model: 'social-post', component: 'PostReach' }])
    expect(dashboardRegionEntries('recordBottom', models)).toEqual([])
    // Not a place a page has: nothing, whatever a model wrote.
    expect(dashboardRegionEntries('footer', models)).toEqual([])
    expect(dashboardRegionEntries(undefined, models)).toEqual([])
  })

  // stacksjs/stacks#3299: the framework's own use of a region, and the only one.
  it('a shipped model places a shipped component, and every one it names exists', () => {
    const shipped = readFileSync('storage/framework/defaults/resources/functions/dashboard/regions.ts', 'utf8')
    expect(shipped).toContain('loadDiscoveredModels()')
    for (const model of ['User', 'Team', 'Subscriber'])
      expect(readFileSync(`storage/framework/defaults/app/Models/${model}.ts`, 'utf8')).toContain('regions: { listTop: \'DataStatCards\' },')
    for (const model of ['Campaign', 'FailedJob'])
      expect(readFileSync(`storage/framework/defaults/app/Models/${model}.ts`, 'utf8')).not.toContain('regions:')

    const models = 'storage/framework/defaults/app/Models'
    const dashboard = 'storage/framework/defaults/resources/components/Dashboard'
    const files = (readdirSync(dashboard, { recursive: true }) as string[]).filter(file => file.endsWith('.stx'))
    const placed = new Set<string>()
    for (const file of (readdirSync(models, { recursive: true }) as string[]).filter(file => file.endsWith('.ts'))) {
      const declared = /regions: \{([^}]*)\}/.exec(readFileSync(join(models, file), 'utf8'))
      for (const [, component] of (declared?.[1] ?? '').matchAll(/: '(\w+)'/g))
        placed.add(component!)
    }
    expect([...placed]).toEqual(['DataStatCards'])
    for (const component of placed) {
      const found = files.filter(file => file.split('/').pop() === `${component}.stx`)
      // One file of that name, in the shipped components and not an app's folder.
      expect(found, component).toHaveLength(1)
      const source = readFileSync(join(dashboard, found[0]!), 'utf8')
      const script = source.slice(0, source.indexOf('</script>'))
      // Its script is set up on every model page that has its place, whether
      // or not it is put there. Nothing at the top of it may ask or watch.
      expect(script, component).not.toMatch(/^(?:void |await )?(?:effect|fetch\w*|load\w*)\(/m)
      expect(script, component).toContain('onMount(() => {')
      expect(script, component).toContain('onDestroy(() => {')
    }
  })

  it('the stat cards watch the list only while they are on the page', () => {
    const cards = readFileSync('storage/framework/defaults/resources/components/Dashboard/Data/DataStatCards.stx', 'utf8')
    const script = cards.slice(0, cards.indexOf('</script>'))
    const mounted = script.slice(script.indexOf('onMount(() => {'), script.indexOf('onDestroy(() => {'))
    expect(mounted).toContain('void loadStatNumbers()')
    expect(mounted).toContain('stopWatchingList = effect(() => {')
    expect(script.slice(script.indexOf('onDestroy(() => {'))).toContain('stopWatchingList?.()')
    // Handed the model and nothing else; which numbers follows from it.
    expect(script).toContain('const statModel = useReactiveProp(\'model\', \'\')')
    expect(script).toContain('const shown = STAT_CARDS[statModel()]')
    // Looped on a wrapper: on the card itself the loop loses its item (stacksjs/stx#2185).
    expect(cards).toContain('<div :for="card in statCards()" class="contents">')
  })
})

describe('what a placed component can read', () => {
  const record = { modelName: 'Team', row: { id: 7, name: 'Northwind' }, columns: [], updateColumns: [], fields: [], relations: {}, relationNames: {}, writeCapabilities: { create: false, update: false, destroy: false, invite: false, anonymize: false }, anonymized: false, actions: [] }

  it('the record a record\'s page is showing, as it loads and after', () => {
    const page = useModelRecord()
    let reloads = 0
    modelPageStore.openRecord('team', '7', () => { reloads++ })
    // The page says which record it is for before it has it.
    expect([page.model(), page.id(), page.record(), page.details()]).toEqual(['team', '7', null, null])
    modelPageStore.showRecord('team', '7', record)
    expect(page.record()).toEqual({ id: 7, name: 'Northwind' })
    expect(page.details()?.modelName).toBe('Team')
    // A component that changed something asks the page to read again.
    page.reload()
    expect(reloads).toBe(1)
  })

  it('never the record of the page before', () => {
    const page = useModelRecord()
    modelPageStore.openRecord('team', '7', () => {})
    modelPageStore.showRecord('team', '7', record)
    // Another record's page opens: nothing is known of it yet.
    modelPageStore.openRecord('team', '8', () => {})
    expect([page.id(), page.record()]).toEqual(['8', null])
    // The page before is torn down after the next one opens. It clears only its own.
    modelPageStore.closeRecord('team', '7')
    expect(page.id()).toBe('8')
    modelPageStore.closeRecord('team', '8')
    expect([page.model(), page.id(), page.record()]).toEqual(['', '', null])
    // And its reload is not kept for a page that is gone.
    let stale = 0
    modelPageStore.openRecord('team', '9', () => { stale++ })
    modelPageStore.closeRecord('team', '9')
    page.reload()
    expect(stale).toBe(0)
  })

  it('opening the same record again keeps what is on the page until it is read', () => {
    const page = useModelRecord()
    modelPageStore.openRecord('team', '7', () => {})
    modelPageStore.showRecord('team', '7', record)
    modelPageStore.openRecord('team', '7', () => {})
    expect(page.record()).toEqual({ id: 7, name: 'Northwind' })
    modelPageStore.closeRecord('team', '7')
  })

  it('what a list is showing, as it is searched, narrowed and paged', () => {
    const list = useModelList()
    let reloads = 0
    modelPageStore.openList('order', () => { reloads++ })
    expect([list.model(), list.rows(), list.total(), list.search(), list.filters()]).toEqual(['order', [], 0, '', {}])
    modelPageStore.showList({ slug: 'order', rows: [{ id: 1 }, { id: 2 }], total: 40, search: 'ava', filters: { status: { in: ['paid'] } } })
    expect([list.rows().length, list.total(), list.search(), list.filters()]).toEqual([2, 40, 'ava', { status: { in: ['paid'] } }])
    list.reload()
    expect(reloads).toBe(1)
    // Another model's list: not the rows of the one before.
    modelPageStore.openList('team', () => {})
    expect([list.model(), list.rows(), list.total()]).toEqual(['team', [], 0])
    modelPageStore.closeList('order')
    expect(list.model()).toBe('team')
    modelPageStore.closeList('team')
    expect([list.model(), list.rows()]).toEqual(['', []])
  })

  it('when the list changed a record, and not when it was only searched or paged', () => {
    const list = useModelList()
    const start = list.changes()
    modelPageStore.openList('team', () => {})
    modelPageStore.showList({ slug: 'team', rows: [{ id: 1 }], total: 1, search: 'north', filters: {} })
    expect(list.changes()).toBe(start)
    // A delete, a bulk run that did something, one of the model's actions.
    modelPageStore.listChanged('team')
    modelPageStore.listChanged('team')
    expect(list.changes()).toBe(start + 2)
    // Only the list in view says so: not one that is gone, nor another model's.
    modelPageStore.listChanged('order')
    modelPageStore.closeList('team')
    modelPageStore.listChanged('team')
    expect(list.changes()).toBe(start + 2)
    // The list says so in the three places it changes a record, and tells no host.
    const source = readFileSync('storage/framework/defaults/resources/components/Dashboard/Models/ModelRecordsDashboard.stx', 'utf8')
    expect((source.match(/modelPageStore\.listChanged\(slug\(\)\)/g) || []).length).toBe(3)
    expect(source).not.toContain('defineEmits')
  })
})

// The pages rely on how stx draws a component whose name is only known when
// the page is drawn. These hold stx to it: a change there would otherwise be
// found in a browser, on an app's page.
describe('a component chosen by name while the page is drawn', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'dashboard-regions-'))
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))
  const components = join(scratch, 'components')
  mkdirSync(components, { recursive: true })
  writeFileSync(join(components, 'OrderTimeline.stx'), '<div data-timeline data-model="{{ model }}" data-region="{{ region }}">timeline</div>\n')
  // The dashboard's own wrapper, as it ships.
  copyFileSync('storage/framework/defaults/resources/components/Dashboard/Models/ModelRegionFor.stx', join(components, 'ModelRegionFor.stx'))

  let pages = 0
  async function render(body: string, exports = ''): Promise<string> {
    const page = join(scratch, `page-${pages++}.stx`)
    writeFileSync(page, `${exports ? `<script server>\n${exports}\n</script>\n` : ''}<main>\n${body}\n</main>\n`)
    return renderTemplate(page, { options: { componentsDir: components } })
  }
  const declared = 'export const placed = \'OrderTimeline\'\nexport const slug = \'order\''

  it('is drawn, with what the server knows handed to it', async () => {
    const html = await render('<component :is="placed" :model="slug" region="recordTop"></component>', declared)
    expect(html).toContain('data-timeline')
    expect(html).toContain('data-model="order"')
    expect(html).toContain('data-region="recordTop"')
  })

  it('is handed nothing in the self-closing form, which is why the wrapper does not use it', async () => {
    const html = await render('<component :is="placed" :model="slug" region="recordTop" />', declared)
    expect(html).toContain('data-timeline')
    expect(html).toContain('data-region=""')
    expect(html).not.toContain('data-region="recordTop"')
  })

  it('the dashboard\'s wrapper draws the model\'s component inside what it mounts', async () => {
    const html = await render('<ModelRegionFor model="order" component="OrderTimeline" place="recordTop" />')
    // The component is in the document, handed its model and its place...
    expect(html).toContain('data-timeline')
    expect(html).toContain('data-model="order"')
    expect(html).toContain('data-region="recordTop"')
    expect(html).not.toMatch(/<component\b/)
    // ...inside the element the page mounts only for that model.
    const wrapper = html.indexOf('data-model-region')
    expect(wrapper).toBeGreaterThan(-1)
    expect(html.slice(0, html.indexOf('data-timeline')).lastIndexOf(':if="mounted()"')).toBeGreaterThan(-1)
    expect(wrapper).toBeLessThan(html.indexOf('data-timeline'))
  })

  it('one wrapper per model that places a component there, from a loop on the server', async () => {
    const html = await render(
      '@foreach(placed as entry)\n<ModelRegionFor model="{{ entry.model }}" component="{{ entry.component }}" place="{{ place }}" />\n@endforeach',
      'export const place = \'recordTop\'\nexport const placed = [{ model: \'order\', component: \'OrderTimeline\' }, { model: \'coupon\', component: \'OrderTimeline\' }]',
    )
    expect((html.match(/data-timeline/g) || []).length).toBe(2)
    expect(html).toContain('data-model="order"')
    expect(html).toContain('data-model="coupon"')
    // And none at all for a place nobody fills.
    const none = await render('@foreach(placed as entry)\n<ModelRegionFor model="{{ entry.model }}" component="{{ entry.component }}" place="{{ place }}" />\n@endforeach', 'export const place = \'listTop\'\nexport const placed = []')
    expect(none).not.toContain('data-model-region')
    expect(none).toContain('<main>')
  })
})

describe('the pages', () => {
  const views = 'storage/framework/defaults/views/dashboard'
  const components = 'storage/framework/defaults/resources/components/Dashboard'
  const read = (path: string) => readFileSync(path, 'utf8')

  it('a record\'s page has a place above its fields and one under everything', () => {
    const page = read(`${components}/Models/ModelRecordDetail.stx`)
    expect(page).toContain('<ModelRegion place="recordTop" />')
    expect(page).toContain('<ModelRegion place="recordBottom" />')
    expect(page.indexOf('<ModelRegion place="recordTop" />')).toBeLessThan(page.indexOf('data-record-content'))
    expect(page.indexOf('<ModelRegion place="recordBottom" />')).toBeGreaterThan(page.indexOf('<ModelRelatedPanels'))
  })

  it('a list has a place above its search and one under its table, wherever it is hosted', () => {
    const list = read(`${components}/Models/ModelRecordsDashboard.stx`)
    // The only thing between the title and the search. A hosting page's
    // stats used to go in a slot before it; they are the model's now.
    expect(list).toContain('<ModelRegion place="listTop" />')
    expect(list).not.toContain('<slot name="summary"')
    expect(list.indexOf('<ModelRegion place="listTop" />')).toBeLessThan(list.indexOf('type="search"'))
    expect(list.indexOf('<ModelRegion place="listBottom" />')).toBeGreaterThan(list.indexOf('</table>'))
    // The page that hosts the list for Users, Teams and Subscribers adds
    // nothing: the list it hosts already has both places.
    expect(read(`${components}/Data/DataModelRecords.stx`)).not.toContain('ModelRegion')
  })

  it('the views are left as they were: a page is the same document at every address', () => {
    // Which is why the model's component is not chosen in the view. stx draws
    // a view with no script of its own once and serves that to every address,
    // so a view cannot know which model it is for.
    for (const view of ['models/[model].stx', 'models/[model]/[id].stx', 'data/users.stx', 'data/teams.stx', 'data/subscribers.stx']) {
      const source = read(`${views}/${view}`)
      expect(source, view).not.toContain('<script')
      expect(source, view).not.toContain('<component')
      expect(source, view).not.toContain('ModelRegion')
    }
  })

  it('the server draws every model\'s component for a place, and the page mounts the one for its model', () => {
    const region = read(`${components}/Models/ModelRegion.stx`)
    expect(region).toContain('const placed = dashboardRegionEntries(place)')
    expect(region).toContain('@foreach(placed as entry)\n<ModelRegionFor model="{{ entry.model }}" component="{{ entry.component }}" place="{{ place }}" />\n@endforeach')
    // Nothing in it asks the address: it is the same for every one.
    expect(region).not.toContain('params')

    const wrapper = read(`${components}/Models/ModelRegionFor.stx`)
    // In its own template, not in a slot: stx leaves a named component in
    // another component's slot undrawn. And in the open and close form.
    expect(wrapper).toContain('<div :if="mounted()" data-model-region :data-region="atPlace()" :data-region-model="forModel()">\n  <component :is="component" :model="model" :region="place"></component>\n</div>')
    expect(wrapper).not.toContain('<slot')
    expect(wrapper).not.toMatch(/<component[^>]*\/>/)
    // Mounted only while the page is showing that model, by what the page said it shows.
    expect(wrapper).toContain('const showing = derived(() => atPlace().startsWith(\'record\') ? modelPageStore.record()?.slug ?? \'\' : modelPageStore.list()?.slug ?? \'\')')
    expect(wrapper).toContain('const mounted = derived(() => forModel() !== \'\' && showing() === forModel())')
    // The only two places the dashboard chooses a component by name.
    const named = readdirSync(components, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.stx') && read(join(entry.parentPath, entry.name)).includes('<component :is='))
      .map(entry => entry.name)
    expect(named).toEqual(['ModelRegionFor.stx'])
  })

  it('each page says which record or list it is before it loads, publishes what it loads, and clears its own when it goes', () => {
    const record = read(`${components}/Models/ModelRecordDetail.stx`)
    const script = record.slice(0, record.indexOf('</script>'))
    expect(script).toContain('modelPageStore.openRecord(slug(), recordId(), () => { void loadRecord() })')
    // Before the first read is asked for, not after it answers.
    expect(script.indexOf('modelPageStore.openRecord(')).toBeLessThan(script.indexOf('onMount(() => {\n  void loadRecord()'))
    expect(script).toContain('modelPageStore.showRecord(slug(), recordId(), loaded)')
    expect(script).toContain('modelPageStore.showRecord(slug(), recordId(), null)')
    expect(script).toContain('onDestroy(() => {\n  modelPageStore.closeRecord(slug(), recordId())\n})')

    const list = read(`${components}/Models/ModelRecordsDashboard.stx`)
    const listScript = list.slice(0, list.indexOf('</script>'))
    // Once mounted: a hosting page's model is not bound before then.
    expect(listScript).toMatch(/onMount\(\(\) => \{\n(?: {2}\/\/[^\n]*\n)* {2}modelPageStore\.openList\(slug\(\), \(\) => \{ void load\(\) \}\)\n {2}void load\(\)\n\}\)/)
    expect(listScript).toContain('modelPageStore.showList({ slug: slug(), rows: data.rows ?? [], total: data.totalCount ?? 0, search: search(), filters: active })')
    expect(listScript).toContain('onDestroy(() => {\n  modelPageStore.closeList(slug())\n})')
  })
})
