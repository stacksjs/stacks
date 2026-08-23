/**
 * Every hardcoded link in the marketing templates, checked against what the
 * site can actually serve.
 *
 * The data-driven links are already covered: marketing-nav.test.ts resolves
 * the menu and footer entries, and the feature, use-case, and comparison
 * tests check the slugs behind them. What is left is the links typed by hand
 * into a view - the hero buttons, the breadcrumbs, the "back to home" on a
 * 404 body, the section anchors - and those are the ones that rot quietly.
 * A wrong one renders exactly like a right one.
 *
 * Fragments get the same treatment. `href="/#start"` is a dead link the day
 * the section it names is renamed, and nothing about the page looks wrong;
 * the browser just does not move.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { comparisons } from '../../resources/data/comparisons'
import { features } from '../../resources/data/features'
import { useCases } from '../../resources/data/use-cases'

const root = join(import.meta.dir, '../..')
const views = join(root, 'resources/views')
const partials = join(root, 'resources/partials')

const dynamicRoutes: Record<string, string[]> = {
  '/features': features.map(feature => feature.slug),
  '/use-cases': useCases.map(useCase => useCase.slug),
  '/compare': comparisons.map(comparison => comparison.slug),
}

/** Served by other apps in the same deploy, so not a view in this project. */
const foreign = ['/docs', '/blog', '/api', '/dashboard']

function templates(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)

    if (entry.isDirectory())
      return templates(path)

    return entry.name.endsWith('.stx') ? [path] : []
  })
}

const files = [...templates(views), ...templates(partials)]

/** href literals only: anything with an expression in it is data-driven. */
function hrefsIn(source: string): string[] {
  return [...source.matchAll(/href="([^"]+)"/g)]
    .map(match => match[1])
    .filter(href => !href.includes('{{') && !href.includes('{!!'))
}

function idsIn(source: string): Set<string> {
  return new Set([...source.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]))
}

function isForeign(path: string): boolean {
  return foreign.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

function resolves(path: string): boolean {
  if (path === '' || path === '/')
    return true

  if (isForeign(path) || path.startsWith('/assets/') || path.startsWith('/images/'))
    return true

  const parent = path.slice(0, path.lastIndexOf('/'))
  const slug = path.slice(path.lastIndexOf('/') + 1)

  if (dynamicRoutes[parent]?.includes(slug))
    return true

  return files.some((file) => {
    const route = `/${relative(views, file).replace(/\.stx$/, '').replace(/\/index$/, '')}`

    return route === path
  })
}

describe('hardcoded links in the templates', () => {
  test('there are templates to check', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  test('every internal path resolves to something the site serves', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8')

      for (const href of hrefsIn(source)) {
        if (!href.startsWith('/'))
          continue

        const path = href.split('#')[0].split('?')[0]

        expect(resolves(path), `${relative(root, file)} -> ${href}`).toBe(true)
      }
    }
  })

  test('every fragment names an id that exists on the page it points at', () => {
    const home = readFileSync(join(views, 'index.stx'), 'utf8')
    const homeIds = idsIn(home)

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const ownIds = idsIn(source)

      for (const href of hrefsIn(source)) {
        if (!href.includes('#'))
          continue

        const [path, fragment] = href.split('#')
        if (!fragment)
          continue

        // A bare `#x` points at the page it is written on; `/#x` at the home
        // page, which is the form the shared chrome has to use.
        if (path === '')
          expect(ownIds, `${relative(root, file)} -> ${href}`).toContain(fragment)
        else if (path === '/')
          expect(homeIds, `${relative(root, file)} -> ${href}`).toContain(fragment)
      }
    }
  })
})

describe('the home page', () => {
  const home = readFileSync(join(views, 'index.stx'), 'utf8')

  test('links to both hubs in its own body, not only through the nav', () => {
    // The mega menus need a hover, which a phone does not have and a reader
    // scrolling the page never performs. These two links are the way in.
    // Asserted as booleans with a message: toContain on a 20kB template
    // prints the whole file when it fails, which buries the actual problem.
    expect(home.includes('href="/use-cases"'), 'home page must link to /use-cases').toBe(true)
    expect(home.includes('href="/compare"'), 'home page must link to /compare').toBe(true)
  })

  test('samples both lists from the data rather than naming slugs', () => {
    // Hardcoding six slugs here is how a home page ends up linking to a page
    // that was renamed six months ago.
    expect(home).toMatch(/const homeUseCases = useCases\./)
    expect(home).toMatch(/const homeComparisons = comparisonGroups\./)
  })
})
