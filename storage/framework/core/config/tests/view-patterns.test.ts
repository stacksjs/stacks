// Which views an app actually serves (stacksjs/stacks#2237).
//
// The dev views server and the production server both registered
// `[userViewsPath, defaultViewsPath]` with no config check, so every Stacks
// app served the scaffold's demo storefront as live public routes — /cart,
// /checkout/payment, /orders/:id — and enumerated them into its sitemap. A
// privacy-analytics SaaS answering /checkout is not a styling problem.
//
// The route registry already lets an app decide what to spread. `resolveViewPatterns`
// is the same lever for views, and it is shared by both servers rather than
// implemented twice: a views policy that dev and production disagree about is
// a defect you only discover in production.

import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  DEFAULT_VIEW_ROUTE_BUNDLES,
  DEFAULT_VIEW_TEMPLATES,
  DEFAULT_VIEWS_ALWAYS,
  resolveViewPatterns,
  withheldDefaultViews,
} from '../src/views'

const USER = 'resources/views'
const DEFAULTS = 'storage/framework/defaults/resources/views'

/** Stand-in for the defaults tree, so the tests do not depend on its contents. */
const PRESENT = new Set([
  join(DEFAULTS, 'errors'),
  join(DEFAULTS, 'emails'),
  join(DEFAULTS, 'dashboard'),
])
const exists = (path: string): boolean => PRESENT.has(path)

describe('default views stay on unless an app says otherwise (#2237)', () => {
  it('registers both roots when unset', () => {
    // Unset withholds individual pages (below), never a root: the app's own
    // views and the defaults' 404 must stay reachable whatever is mounted.
    expect(resolveViewPatterns(USER, DEFAULTS, undefined, exists, []).patterns)
      .toEqual([USER, DEFAULTS])
  })

  it('registers both when true', () => {
    expect(resolveViewPatterns(USER, DEFAULTS, true, exists).patterns)
      .toEqual([USER, DEFAULTS])
  })

  it('ignores a non-boolean, non-array value rather than serving nothing', () => {
    // A bad config value must not silently take the app's own views down with
    // it — falling back to the previous behaviour is the safe direction.
    expect(resolveViewPatterns(USER, DEFAULTS, 'yes' as any, exists).patterns)
      .toEqual([USER, DEFAULTS])
  })
})

describe('an app can opt out (#2237)', () => {
  it('false registers only the app views', () => {
    const { patterns, missing } = resolveViewPatterns(USER, DEFAULTS, false, exists)
    expect(patterns).toEqual([USER])
    expect(missing).toEqual([])
  })

  it('an array registers only the named subtrees', () => {
    expect(resolveViewPatterns(USER, DEFAULTS, ['errors', 'emails'], exists).patterns)
      .toEqual([USER, join(DEFAULTS, 'errors'), join(DEFAULTS, 'emails')])
  })

  it('the storefront is gone when it is not named', () => {
    // The concrete complaint: /cart and /checkout must not be reachable.
    const { patterns } = resolveViewPatterns(USER, DEFAULTS, ['errors'], exists)
    expect(patterns).not.toContain(DEFAULTS)
    expect(patterns.some(p => p.includes('checkout'))).toBeFalse()
  })

  it('an empty array is the same as false', () => {
    expect(resolveViewPatterns(USER, DEFAULTS, [], exists).patterns).toEqual([USER])
  })

  it('reports a name that does not exist instead of dropping it', () => {
    // Silently ignoring a typo is indistinguishable from the subtree being
    // turned off, so the caller gets something to warn about.
    const { patterns, missing } = resolveViewPatterns(USER, DEFAULTS, ['errors', 'typo'], exists)
    expect(patterns).toEqual([USER, join(DEFAULTS, 'errors')])
    expect(missing).toEqual(['typo'])
  })

  it('refuses to escape the defaults tree', () => {
    // `..` or a leading slash would register a directory the app never asked
    // for — including, with enough of them, the whole project.
    const { patterns } = resolveViewPatterns(USER, DEFAULTS, ['../../..', '/etc', ''], exists)
    expect(patterns).toEqual([USER])
  })
})

describe('both servers go through it (#2237)', () => {
  // Static assertions: a call site that composes its own array is how dev and
  // production drift apart, and the drift is invisible until deploy.
  const dev = readFileSync(join(import.meta.dir, '../../actions/src/dev/views.ts'), 'utf8')
  const prod = readFileSync(join(import.meta.dir, '../../buddy/src/production-server.ts'), 'utf8')

  it('the dev server resolves its patterns', () => {
    expect(dev).toContain('resolveViewPatterns(')
    expect(dev).toContain('patterns: viewPatterns.patterns')
  })

  it('the production server resolves its patterns', () => {
    expect(prod).toContain('resolveViewPatterns(')
    expect(prod).toContain('patterns: viewPatterns.patterns')
  })

  it('neither still hardcodes the pair', () => {
    expect(dev).not.toContain('patterns: [userViewsPath, defaultViewsPath]')
    expect(prod).not.toContain('patterns: [userViewsPath, defaultViewsPath]')
  })
})

// Unset serves the default pages that have routes behind them.
//
// Verified live on 2026-09-27: uplink.stacksjs.com, running with
// STACKS_DEFAULT_ROUTES=none, answered 200 on /login, /register, /cart,
// /checkout/payment, /orders/1, /cms/page and /auth/magic/x - every one a form
// posting into a route the app never mounted - until it set
// `defaultViews: false` by hand. The route bundles already say what an app
// mounts; the pages now follow them.

const ALL_BUNDLES = new Set(['auth', 'dashboard', 'delivery', 'email', 'forms', 'payments'])
const NO_BUNDLES = new Set<string>()

const AUTH_PAGES = ['login.stx', 'register.stx', 'forgot-password.stx', 'password', 'auth']
const STOREFRONT_PAGES = ['cart.stx', 'checkout', 'orders', 'dashboard']

function unset(mounted: ReadonlySet<string> | undefined) {
  return resolveViewPatterns(USER, DEFAULTS, undefined, exists, [], mounted)
}

describe('unset defaultViews follows the mounted route bundles', () => {
  it('an app mounting every bundle keeps every page, and loses only the CMS templates', () => {
    // The app that set nothing anywhere: `dashboard` defaults on, so auth and
    // the storefront both mount, and nothing it answered before goes away
    // except `/cms/*`, which was never a working page.
    const { withheld, exclude } = unset(ALL_BUNDLES)
    expect(withheld).toEqual(['cms'])
    expect(exclude).toEqual([join(DEFAULTS, 'cms')])
  })

  it('an app mounting nothing serves neither the auth pages nor the storefront', () => {
    const { withheld, exclude } = unset(NO_BUNDLES)
    expect(withheld).toEqual([...AUTH_PAGES, ...STOREFRONT_PAGES, 'cms'])
    expect(exclude).toEqual(withheld.map(name => join(DEFAULTS, name)))
  })

  it('auth alone keeps every auth page and withholds the storefront', () => {
    const { withheld } = unset(new Set(['auth']))
    for (const page of AUTH_PAGES)
      expect(withheld).not.toContain(page)
    for (const page of STOREFRONT_PAGES)
      expect(withheld).toContain(page)
  })

  it('the storefront follows the dashboard bundle, where its routes live', () => {
    // defaults/routes/dashboard.ts carries /api/cart/* and /api/checkout/*;
    // there is no storefront bundle of its own.
    const { withheld } = unset(new Set(['dashboard']))
    for (const page of STOREFRONT_PAGES)
      expect(withheld).not.toContain(page)
    for (const page of AUTH_PAGES)
      expect(withheld).toContain(page)
  })

  it('bundles no default page depends on change nothing', () => {
    expect(unset(new Set(['email', 'forms', 'delivery'])).withheld).toEqual(unset(NO_BUNDLES).withheld)
  })

  it('never withholds the error pages or coming-soon', () => {
    for (const mounted of [NO_BUNDLES, ALL_BUNDLES]) {
      const { withheld } = unset(mounted)
      for (const page of DEFAULT_VIEWS_ALWAYS)
        expect(withheld).not.toContain(page)
    }
    expect(DEFAULT_VIEWS_ALWAYS).toContain('errors')
    expect(DEFAULT_VIEWS_ALWAYS).toContain('coming-soon.stx')
  })

  it('a caller that passes no bundles gets none, not all', () => {
    // Forgetting the argument must lose pages loudly, not quietly reopen the
    // hole this closes.
    expect(resolveViewPatterns(USER, DEFAULTS, undefined, exists, []).withheld)
      .toEqual(unset(NO_BUNDLES).withheld)
  })

  it('withheldDefaultViews is the same answer', () => {
    expect(withheldDefaultViews(new Set(['auth']))).toEqual(unset(new Set(['auth'])).withheld)
  })
})

describe('explicit settings keep their meaning whatever is mounted', () => {
  it('true serves every default view', () => {
    const { patterns, exclude, withheld } = resolveViewPatterns(USER, DEFAULTS, true, exists, [], NO_BUNDLES)
    expect(patterns).toEqual([USER, DEFAULTS])
    expect(exclude).toEqual([])
    expect(withheld).toEqual([])
  })

  it('false serves none', () => {
    const { patterns, exclude } = resolveViewPatterns(USER, DEFAULTS, false, exists, [], ALL_BUNDLES)
    expect(patterns).toEqual([USER])
    expect(exclude).toEqual([])
  })

  it('a list serves exactly the subtrees it names', () => {
    const { patterns, exclude } = resolveViewPatterns(USER, DEFAULTS, ['errors', 'dashboard'], exists, [], NO_BUNDLES)
    expect(patterns).toEqual([USER, join(DEFAULTS, 'errors'), join(DEFAULTS, 'dashboard')])
    expect(exclude).toEqual([])
  })
})

describe('every default view is classified (the real tree)', () => {
  // Against the shipped defaults directory, not a stand-in: a page added
  // without deciding what it needs would otherwise be served in every app,
  // which is how the storefront and the auth pages got there.
  const root = join(import.meta.dir, '../../../defaults/resources/views')

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name)
      return statSync(full).isDirectory() ? walk(full) : [relative(root, full)]
    }).filter(file => /\.(?:stx|md|html)$/.test(file))
  }

  const classified: Array<[string, string]> = [
    ...Object.entries(DEFAULT_VIEW_ROUTE_BUNDLES).flatMap(([bundle, views]) => views.map(view => [view, bundle] as [string, string])),
    ...DEFAULT_VIEW_TEMPLATES.map(view => [view, 'template'] as [string, string]),
    ...DEFAULT_VIEWS_ALWAYS.map(view => [view, 'always'] as [string, string]),
  ]

  function owners(file: string): string[] {
    return classified
      .filter(([entry]) => file === entry || file.startsWith(`${entry}/`))
      .map(([, owner]) => owner)
  }

  it('finds the tree', () => {
    expect(walk(root)).toContain('login.stx')
  })

  it('every entry names something that exists', () => {
    // A renamed page must not leave its entry pointing at nothing while the
    // new name is served everywhere.
    for (const [entry] of classified)
      expect(existsSync(join(root, entry))).toBeTrue()
  })

  it('every file belongs to exactly one list', () => {
    const unclassified = walk(root).filter(file => owners(file).length !== 1)
    expect(unclassified).toEqual([])
  })

  it('maps the pages the uplink report named', () => {
    expect(owners('login.stx')).toEqual(['auth'])
    expect(owners('register.stx')).toEqual(['auth'])
    expect(owners('forgot-password.stx')).toEqual(['auth'])
    expect(owners('password/reset/[token].stx')).toEqual(['auth'])
    expect(owners('auth/magic/[token].stx')).toEqual(['auth'])
    expect(owners('cart.stx')).toEqual(['dashboard'])
    expect(owners('checkout/payment.stx')).toEqual(['dashboard'])
    expect(owners('orders/[id].stx')).toEqual(['dashboard'])
    expect(owners('cms/page.stx')).toEqual(['template'])
    expect(owners('errors/404.stx')).toEqual(['always'])
    expect(owners('coming-soon.stx')).toEqual(['always'])
  })
})

describe('both servers hand stx the exclusions and the mounted bundles', () => {
  const dev = readFileSync(join(import.meta.dir, '../../actions/src/dev/views.ts'), 'utf8')
  const prod = readFileSync(join(import.meta.dir, '../../buddy/src/production-server.ts'), 'utf8')
  const sitemap = readFileSync(join(import.meta.dir, '../../../defaults/app/Actions/SitemapAction.ts'), 'utf8')

  for (const [name, source] of [['dev', dev], ['production', prod]] as const) {
    it(`${name} passes exclude to stx`, () => {
      // Resolving the list and not handing it over is the failure that looks
      // exactly like working in every test but this one.
      expect(source).toContain('exclude: viewPatterns.exclude')
    })

    it(`${name} decides mounting the way bootstrap does`, () => {
      expect(source).toContain('mountedDefaultRouteBundles(feature)')
    })
  }

  it('the sitemap lists what the servers serve', () => {
    expect(sitemap).toContain('resolveViewPatterns(')
    expect(sitemap).toContain('mountedDefaultRouteBundles(feature)')
    expect(sitemap).not.toContain('storage/framework/defaults/resources/views')
  })
})
