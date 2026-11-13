/**
 * The app components a model places on its dashboard pages
 * (`dashboard.regions`).
 *
 * There were two ways to change one of the dashboard's pages: say something
 * on the model's `dashboard` block that the dashboard already knows how to
 * draw, or replace the page with a file of the same name and own it from
 * then on. To add one panel to a record's page an app copied the page.
 *
 * A region is the step between. The model names a component of the app's
 * own for a place on the page, as it names an action for a button, and the
 * framework's page draws it there:
 *
 * ```ts
 * dashboard: { regions: { recordTop: 'OrderTimeline' } }
 * ```
 *
 * A page reads this on the server, before it is drawn, because that is when
 * a component can be chosen by name: the address says which model the page
 * is for, and the manifest the dashboard is started with carries what each
 * model declared. Read synchronously, as the sidebar is.
 */
import type { DiscoveredModel } from './sidebar'
import { loadDiscoveredModels } from './sidebar'

/** The places a component can be put. `DashboardModelRegionName` in `@stacksjs/types`. */
export const DASHBOARD_MODEL_REGIONS = ['listTop', 'listBottom', 'recordTop', 'recordBottom'] as const
export type DashboardRegionName = typeof DASHBOARD_MODEL_REGIONS[number]

/** The component at each place, or an empty string where the model names none. */
export type DashboardRegions = Record<DashboardRegionName, string>

/**
 * A component's name, as its file is called: `OrderTimeline`. Nothing else,
 * since the name is what the file is looked up by.
 */
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/

const NONE: DashboardRegions = { listTop: '', listBottom: '', recordTop: '', recordBottom: '' }

/** Read a declaration: the places it fills, and what in it could not be used. */
export function readDashboardRegions(declared: unknown): { regions: DashboardRegions, problems: string[] } {
  const regions: DashboardRegions = { ...NONE }
  const problems: string[] = []
  if (declared === undefined || declared === null)
    return { regions, problems }
  if (typeof declared !== 'object' || Array.isArray(declared)) {
    problems.push('it is not an object of places and component names')
    return { regions, problems }
  }
  for (const [place, name] of Object.entries(declared as Record<string, unknown>)) {
    if (!(DASHBOARD_MODEL_REGIONS as readonly string[]).includes(place)) {
      problems.push(`'${place}' is not a place a component can be put: ${DASHBOARD_MODEL_REGIONS.join(', ')}`)
      continue
    }
    if (typeof name !== 'string' || !COMPONENT_NAME.test(name)) {
      problems.push(`'${place}' must name a component as its file is called, such as 'OrderTimeline'`)
      continue
    }
    regions[place as DashboardRegionName] = name
  }
  return { regions, problems }
}

const warned = new Set<string>()

/**
 * The components the model at this address places on its pages.
 *
 * `slug` is the model as an address has it (`social-post`). A model the
 * dashboard does not know, or one that names nothing, places nothing. What
 * could not be used is logged once per model, by name.
 */
export function dashboardModelRegions(slug: unknown, models: readonly DiscoveredModel[] = loadDiscoveredModels()): DashboardRegions {
  const model = typeof slug === 'string' ? models.find(candidate => candidate.id === slug) : undefined
  const { regions, problems } = readDashboardRegions(model?.dashboard?.regions)
  if (model && problems.length > 0 && !warned.has(model.name)) {
    warned.add(model.name)
    for (const problem of problems)
      console.warn(`[dashboard] ${model.name} dashboard.regions: ${problem}. It is left out.`)
  }
  return regions
}

/** One component placed at a place, and the model that placed it. */
export interface DashboardRegionEntry {
  /** The model, as an address has it: `social-post`. */
  model: string
  component: string
}

/**
 * Every component placed at one place, by the model that placed it.
 *
 * A dashboard page is the same document whatever address it is opened at:
 * it is drawn once, and reads its address in the browser. So the server
 * cannot draw "this model's component". It draws the component of every
 * model that places one here, and the page mounts the one for the model in
 * front of the viewer (`Models/ModelRegion.stx`).
 *
 * A place the dashboard does not have draws nothing.
 */
export function dashboardRegionEntries(place: unknown, models: readonly DiscoveredModel[] = loadDiscoveredModels()): DashboardRegionEntry[] {
  if (typeof place !== 'string' || !(DASHBOARD_MODEL_REGIONS as readonly string[]).includes(place))
    return []
  const entries: DashboardRegionEntry[] = []
  for (const model of models) {
    const component = dashboardModelRegions(model.id, models)[place as DashboardRegionName]
    if (component)
      entries.push({ model: model.id, component })
  }
  return entries.sort((a, b) => a.model.localeCompare(b.model))
}
