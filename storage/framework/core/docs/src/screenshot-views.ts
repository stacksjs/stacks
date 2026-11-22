/**
 * A screenshot inventory derived from the application's stx views.
 *
 * stx already knows every page an application serves: one template per route
 * under `resources/views`. This turns that route table into screenshot pages,
 * so a new view is captured the next time the command runs, without anyone
 * remembering to add it to a list.
 */
import type { ScreenshotPage } from './screenshots'
import { createRouter } from '@stacksjs/stx'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

/** One stx view, as the router serves it. */
export interface ViewScreen {
  /** Stable id derived from the route: `/coaches/plan-builder` is `coaches-plan-builder`. */
  id: string
  /** Route pattern with bracket parameters: `/workouts/[id]`. */
  route: string
  /** Project-relative template path. */
  source: string
  /** First route segment, or `home` for the root. Useful for grouping and role rules. */
  group: string
  params: string[]
  dynamic: boolean
  /** Readable name from the template's `<title>` or its route. */
  title: string
  /** The layout the template extends, e.g. `layouts/app`. Often tells who the screen is for. */
  layout?: string
  /** The template text, for rules that read an access marker such as `requireAuth()`. */
  text: string
}

/** What a rule may change about one discovered view. `false` or a string leaves it out, with that reason. */
export type ViewScreenRule = Partial<Omit<ScreenshotPage, 'sources'>> | string | false | undefined | void

export interface ViewScreenOptions {
  /** Project root. Default: the current directory. */
  root?: string
  /** View directories, relative to the root. Default `['resources/views']`. */
  directories?: string[]
  /** Applied to every view before its own rule. `waitFor` defaults to `body`. */
  defaults?: Partial<Pick<ScreenshotPage, 'waitFor' | 'profiles' | 'masks' | 'prepare' | 'ready' | 'reason'>>
  /** Rules by exact route pattern, e.g. `'/workouts/[id]': { path: ({ fixtures }) => ... }`. */
  routes?: Record<string, ViewScreenRule>
  /** A rule computed per view, e.g. the signed-in role by route prefix. Runs before `routes`. */
  each?: (view: ViewScreen) => ViewScreenRule
  /** Extra states of a route that no template alone describes, appended as written. */
  extra?: ScreenshotPage[]
  /** Fail instead of listing a dynamic route as an explained gap when it has no concrete path. */
  strict?: boolean
}

const words = (value: string): string => value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
const sentence = (value: string): string => value ? value[0]!.toUpperCase() + value.slice(1) : value

function read(file: string): string {
  try { return readFileSync(file, 'utf8') }
  catch { return '' /* A view that cannot be read still gets a route-derived title. */ }
}
function titleOf(text: string, route: string): string {
  const tag = text.match(/<title>([^<{@]+)<\/title>/i)?.[1]?.trim()
  if (tag) return tag
  const parts = route.split('/').filter(Boolean).map(part => part.startsWith('[') ? `by ${words(part.slice(1, -1).replace(/^\.\.\./, ''))}` : words(part))
  return parts.length ? sentence(parts.join(' / ')) : 'Home'
}

/** Every stx view under the given directories, in route order. Reads files only; opens no browser. */
export function discoverViews(options: Pick<ViewScreenOptions, 'root' | 'directories'> = {}): ViewScreen[] {
  const root = resolve(options.root ?? process.cwd())
  const views: ViewScreen[] = []
  const ids = new Set<string>()
  for (const directory of options.directories ?? ['resources/views']) {
    for (const entry of createRouter(root, { pagesDir: directory, emit: false })) {
      const route = entry.pattern.replace(/\*(\w*)/g, (_all, name: string) => `[...${name || 'path'}]`).replace(/:(\w+)/g, '[$1]')
      const base = route.split('/').filter(Boolean).map(part => part.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')).filter(Boolean).join('-').toLowerCase() || 'index'
      let id = base
      for (let copy = 2; ids.has(id); copy++) id = `${base}-${copy}`
      ids.add(id)
      const text = read(entry.filePath)
      const layout = text.match(/@(?:extends|layout)\(\s*['"]([^'"]+)['"]/)?.[1]
      views.push({
        id,
        route,
        source: relative(root, entry.filePath).replaceAll('\\', '/'),
        group: route.split('/').filter(Boolean)[0]?.replace(/^\[.*\]$/, 'profile') ?? 'home',
        params: [...entry.params],
        dynamic: entry.isDynamic,
        title: titleOf(text, route),
        ...(layout ? { layout } : {}),
        text,
      })
    }
  }
  // Code-point order, so the inventory is identical on every machine and locale.
  return views.sort((a, b) => a.route < b.route ? -1 : a.route > b.route ? 1 : 0)
}

/**
 * Screenshot pages for every stx view.
 *
 * A static route is captured as it is. A dynamic route needs a concrete
 * address: give its rule a `path` (a seeded example or a fixture resolver) or
 * a `model`. Without one it stays in the inventory as an explained gap, so
 * the report shows exactly which screens still lack a fixture.
 */
export function screensFromViews(options: ViewScreenOptions = {}): ScreenshotPage[] {
  const pages: ScreenshotPage[] = []
  const known = new Set<string>()
  for (const view of discoverViews(options)) {
    known.add(view.route)
    const rules = [options.each?.(view), options.routes?.[view.route]]
    const page: ScreenshotPage = {
      id: view.id,
      title: view.title,
      path: view.route,
      description: `The ${view.title} screen, served at ${view.route}.`,
      waitFor: 'body',
      ...options.defaults,
      sources: [view.source],
    }
    for (const rule of rules) {
      if (rule === undefined) continue
      if (rule === false || typeof rule === 'string') { page.skip = rule || 'Left out of the screen documentation on purpose.'; continue }
      Object.assign(page, rule)
    }
    if (view.dynamic && typeof page.path === 'string' && page.path === view.route && !page.model && !page.skip) {
      if (options.strict) throw new Error(`Dynamic view needs a concrete path or model: ${view.route} (${view.source})`)
      page.skip = `Needs a seeded example: give ${view.route} a concrete path, fixture resolver or model.`
    }
    if (typeof page.path === 'function' && !page.route) page.route = view.route
    pages.push(page)
  }
  for (const route of Object.keys(options.routes ?? {})) {
    if (!known.has(route)) throw new Error(`Screenshot rule for a view that does not exist: ${route}`)
  }
  return [...pages, ...(options.extra ?? [])]
}
