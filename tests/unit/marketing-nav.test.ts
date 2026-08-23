/**
 * The site chrome: three mega menus and a footer, all built from
 * resources/data/nav.ts.
 *
 * Two things are worth pinning here.
 *
 * The first is that every link in the chrome goes somewhere. The menus are
 * generated from the three lists, so they cannot invent a page, but the
 * hand-written entries (the aside actions, the resources column, the flat
 * links) can and did: the nav used to offer anchors the page below it no
 * longer had. resolves() below answers the same question the browser will,
 * against the views on disk and the lists behind the dynamic routes.
 *
 * The second is subtler. Both partials carry their own `<script server>` and
 * import nav.ts, which is what lets a page include them without declaring
 * navLinks or megaGroups. If someone "tidies" that import away and goes back
 * to reading page scope, every page that does not happen to declare those
 * consts renders a nav with no menus in it - no error, just a bare brand and
 * a GitHub button. So the imports are pinned.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { comparisons } from '../../resources/data/comparisons'
import { features } from '../../resources/data/features'
import { footerColumns, navLinks, navMenus } from '../../resources/data/nav'
import { useCases } from '../../resources/data/use-cases'

const root = join(import.meta.dir, '../..')
const views = join(root, 'resources/views')
const partials = join(root, 'resources/partials')

const dynamicRoutes: Record<string, string[]> = {
  '/features': features.map(feature => feature.slug),
  '/use-cases': useCases.map(useCase => useCase.slug),
  '/compare': comparisons.map(comparison => comparison.slug),
}

/** Everything served by another app in the same deploy, so not a view here. */
const foreign = ['/docs', '/blog']

function resolves(url: string): boolean {
  if (url.startsWith('http'))
    return true

  const path = url.split('#')[0].split('?')[0]

  if (path === '' || path === '/')
    return existsSync(join(views, 'index.stx'))

  if (foreign.some(prefix => path === prefix || path.startsWith(`${prefix}/`)))
    return true

  if (existsSync(join(views, `${path}.stx`)) || existsSync(join(views, path, 'index.stx')))
    return true

  const parent = path.slice(0, path.lastIndexOf('/'))
  const slug = path.slice(path.lastIndexOf('/') + 1)

  return Boolean(dynamicRoutes[parent]?.includes(slug))
}

describe('the mega menus', () => {
  test('there is one per list, each pointing at its own overview', () => {
    expect(navMenus.map(menu => menu.id)).toEqual(['features', 'use-cases', 'compare'])

    for (const menu of navMenus)
      expect(resolves(menu.url)).toBe(true)
  })

  test('every menu link, and every aside action, goes somewhere real', () => {
    for (const menu of navMenus) {
      expect(menu.columns.length).toBeGreaterThan(0)

      for (const column of menu.columns) {
        // An empty column renders as a heading with nothing under it.
        expect(column.links.length).toBeGreaterThan(0)

        for (const link of column.links) {
          expect(link.title.trim().length).toBeGreaterThan(0)
          expect(link.icon).toMatch(/^i-/)
          expect(resolves(link.url), `${menu.id}: ${link.url}`).toBe(true)
        }
      }

      for (const action of menu.aside.actions)
        expect(resolves(action.url), `${menu.id} aside: ${action.url}`).toBe(true)
    }
  })

  test('the menus show every entry of the list behind them', () => {
    const counts = navMenus.map(menu => menu.columns.reduce((total, column) => total + column.links.length, 0))

    expect(counts).toEqual([features.length, useCases.length, comparisons.length])
  })
})

describe('the flat links and the footer', () => {
  test('every flat nav link resolves, and page anchors are absolute', () => {
    for (const link of navLinks) {
      expect(resolves(link.url), link.url).toBe(true)
      // The nav is on every page now, so a bare `#start` would scroll to
      // nothing on /compare.
      expect(link.url.startsWith('#')).toBe(false)
    }
  })

  test('every footer link resolves', () => {
    expect(footerColumns.length).toBeGreaterThanOrEqual(4)

    for (const column of footerColumns) {
      expect(column.links.length).toBeGreaterThan(0)

      for (const link of column.links)
        expect(resolves(link.url), `${column.title}: ${link.url}`).toBe(true)
    }
  })

  test('external footer links skip the client router', () => {
    // Without data-no-router the in-page router intercepts the click and
    // tries to swap in a page it cannot fetch.
    for (const column of footerColumns) {
      for (const link of column.links) {
        if (link.url.startsWith('http') || foreign.some(prefix => link.url.startsWith(prefix)))
          expect(link.native, link.url).toBe(true)
      }
    }
  })
})

describe('the chrome partials', () => {
  const nav = readFileSync(join(partials, 'marketing-nav.stx'), 'utf8')
  const footer = readFileSync(join(partials, 'marketing-footer.stx'), 'utf8')

  test('both read nav.ts in their own script rather than the page scope', () => {
    expect(nav).toContain('<script server>')
    expect(nav).toMatch(/import \{[^}]*navMenus[^}]*\} from '\.\.\/data\/nav'/)

    expect(footer).toContain('<script server>')
    expect(footer).toMatch(/import \{[^}]*footerColumns[^}]*\} from '\.\.\/data\/nav'/)
  })

  test('neither depends on a const the including page has to declare', () => {
    expect(nav).not.toContain('megaGroups')
    expect(nav).not.toContain('appName')
    expect(footer).not.toContain('appName')
  })
})
