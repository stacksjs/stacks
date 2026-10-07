import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { packageViewRoots } from './discovered-resources'
import type { PackageResourceRoot } from './discovered-resources'

/**
 * Whether an app serves the framework's default views, and which of them.
 *
 * Unset (the default) serves the default views that have routes behind them:
 * each page that posts to a framework route bundle is served only while that
 * bundle is mounted, see {@link DEFAULT_VIEW_ROUTE_BUNDLES}. `true` serves
 * every default view whatever is mounted, which is what unset used to mean.
 * `false` registers the app's own views only. An array registers just the
 * named subtrees of the defaults directory: `['errors', 'emails']` for an app
 * that wants the error pages and the mail previews but not the demo storefront.
 */
export type DefaultViewsSetting = boolean | string[]

/**
 * The default views that are only as good as a route bundle behind them,
 * keyed by bundle (`STACKS_DEFAULT_ROUTES`; see `resolveDefaultRouteBundles`
 * in `@stacksjs/router`). Entries are files or directories under the defaults
 * views directory.
 *
 * `auth` - every page posts to `defaults/routes/auth.ts`: `/login` to
 * `POST /login`, `/register` to `POST /register`, `/forgot-password` to
 * `POST /password/forgot`, `/password/reset/{token}` to `POST /password/reset`,
 * `/auth/magic/{token}` to `POST /auth/magic-link/consume`.
 *
 * `dashboard` - the storefront, whose routes live in `defaults/routes/dashboard.ts`
 * and not in a bundle of their own: `/cart` posts to `/api/cart/update`, the
 * three checkout steps to `/api/checkout/{contact,shipping,place}`, and
 * `/orders/{id}` is where `place` lands. `dashboard/index.stx` is the stub
 * `/dashboard` renders on the views server, meaningless without the bundle.
 * `feedback/{token}` posts to `/api/feedback/{token}` from the same file.
 *
 * Served with every bundle mounted, withheld without it: an app answering 200
 * on `/login` whose form posts into a 404 is worse than an app answering 404.
 */
export const DEFAULT_VIEW_ROUTE_BUNDLES: Readonly<Record<string, readonly string[]>> = {
  auth: ['login.stx', 'register.stx', 'forgot-password.stx', 'password', 'auth'],
  dashboard: ['cart.stx', 'checkout', 'orders', 'dashboard', 'feedback'],
}

/**
 * Default views that are templates, never routes of their own.
 *
 * `cms/page.stx` and `cms/blocks/*` are rendered BY PATH - `renderCmsPage`
 * resolves them with its own lookup and hands them the page it found - and a
 * published CMS page is served at its own URL by the CMS fallback. Routed
 * directly, `/cms/page` renders the shell around no page at all, with or
 * without CMS enabled, so there is no bundle to wait for.
 */
export const DEFAULT_VIEW_TEMPLATES: readonly string[] = ['cms']

/**
 * Default views served whatever is mounted: the home fallback, the
 * coming-soon page the maintenance gate renders, the error pages (the 404
 * lookup, and `errors/tester`, which gates itself to local deployments) and
 * the mail previews. Named so a test can hold every file in the defaults
 * tree to exactly one of these three lists.
 */
export const DEFAULT_VIEWS_ALWAYS: readonly string[] = ['index.stx', 'coming-soon.stx', 'errors', 'emails']

export interface ViewPatternResolution {
  /** What to hand stx as `patterns`, in precedence order (app views first). */
  patterns: string[]
  /**
   * Names listed in the config that do not exist under the defaults directory.
   * Reported rather than silently dropped: a typo would otherwise read as
   * "that subtree is turned off", which is indistinguishable from working.
   */
  missing: string[]
  /**
   * Files and directories under the defaults tree that are NOT served even
   * though a pattern above holds them - stx-serve's `exclude`. Only the unset
   * setting withholds anything.
   */
  exclude: string[]
  /**
   * {@link exclude}, relative to the defaults directory, for the boot log. A
   * page that answered yesterday and 404s today should say why.
   */
  withheld: string[]
}

/**
 * The default views withheld when `defaultViews` is unset: the pages of every
 * bundle that is not mounted, and the templates that are never routes.
 * Relative to the defaults views directory.
 */
export function withheldDefaultViews(mountedBundles: ReadonlySet<string>): string[] {
  const withheld: string[] = []
  for (const [bundle, views] of Object.entries(DEFAULT_VIEW_ROUTE_BUNDLES)) {
    if (!mountedBundles.has(bundle))
      withheld.push(...views)
  }
  withheld.push(...DEFAULT_VIEW_TEMPLATES)
  return withheld
}

/**
 * Compose the view patterns for the dev and production servers
 * (stacksjs/stacks#2237).
 *
 * Both servers registered `[userViewsPath, defaultViewsPath]` unconditionally,
 * so every Stacks app served the scaffold's demo storefront as live public
 * routes — `/cart`, `/checkout/payment`, `/orders/:id` — and enumerated them
 * into its sitemap. An analytics SaaS has no business answering `/checkout`.
 *
 * The route registry already lets an app decide what to spread; this is the
 * same lever for views.
 *
 * Shared by both callers on purpose. They are in different packages and have
 * drifted before — `requestContext` is installed twice, differently, which is
 * its own report (#2232) — and a views policy that dev and production disagree
 * about is a defect you only find in production.
 *
 * `exists` is injectable so the resolution is testable without a fixture tree;
 * it defaults to the real filesystem.
 *
 * Views a discovered package ships are appended LAST, after everything above.
 * stx's `getRoute()` returns the first pattern whose relative path matches, so
 * anything appended after the existing roots cannot change the answer for a
 * path that already resolves. That is what makes this additive for an app with
 * no packages, and for every pre-existing route in an app with them.
 *
 * `defaultViews` is not consulted for packages. That setting decides whether
 * the app serves the FRAMEWORK's demo views; an application that installed a
 * package asked for that package's pages either way.
 *
 * ## Unset serves what has routes behind it
 *
 * An unset `defaultViews` used to mean every default view, so an app that ran
 * with `STACKS_DEFAULT_ROUTES=none` still answered 200 on `/login`,
 * `/register`, `/cart`, `/checkout/payment` and `/orders/1`, each a form
 * posting into a route that app never mounted (uplink.stacksjs.com, Sep 2026).
 * Unset now withholds the pages of every bundle not in `mountedBundles` (see
 * {@link DEFAULT_VIEW_ROUTE_BUNDLES}), plus the CMS templates that were never
 * routes. An app mounting a bundle keeps every page of it, and an app with
 * every bundle mounted - one that set nothing anywhere - serves exactly what
 * it did, minus `/cms/*`.
 *
 * `mountedBundles` is what `mountedDefaultRouteBundles` in `@stacksjs/router`
 * answers; it is a parameter because the router depends on this package. Left
 * out, nothing counts as mounted: a caller that forgot it loses pages loudly,
 * rather than serving forms into routes that are not there.
 *
 * The explicit settings keep their meaning and withhold nothing: `true` is
 * every default view, `false` none, a list exactly the subtrees it names.
 */
export function resolveViewPatterns(
  userViewsPath: string,
  defaultViewsPath: string,
  setting: DefaultViewsSetting | undefined,
  exists: (path: string) => boolean = existsSync,
  packageViews: PackageResourceRoot[] = packageViewRoots({ exists }),
  mountedBundles: ReadonlySet<string> = new Set(),
): ViewPatternResolution {
  const fromPackages = packageViews.map(root => root.dir)

  if (setting === undefined) {
    const withheld = withheldDefaultViews(mountedBundles)
    return {
      patterns: [userViewsPath, defaultViewsPath, ...fromPackages],
      missing: [],
      exclude: withheld.map(name => join(defaultViewsPath, name)),
      withheld,
    }
  }

  if (setting === true)
    return { patterns: [userViewsPath, defaultViewsPath, ...fromPackages], missing: [], exclude: [], withheld: [] }

  if (setting === false)
    return { patterns: [userViewsPath, ...fromPackages], missing: [], exclude: [], withheld: [] }

  // Not a setting at all. Falling back to every default view is what this did
  // before unset changed meaning, and the direction that cannot take the
  // app's own pages down with it.
  if (!Array.isArray(setting))
    return { patterns: [userViewsPath, defaultViewsPath, ...fromPackages], missing: [], exclude: [], withheld: [] }

  const patterns = [userViewsPath]
  const missing: string[] = []

  for (const name of setting) {
    // A leading slash or a `..` segment would escape the defaults tree and
    // register something the app never asked for.
    const cleaned = String(name).replace(/^[/\\]+/, '')
    if (!cleaned || cleaned.split(/[/\\]/).includes('..'))
      continue

    const candidate = join(defaultViewsPath, cleaned)
    if (exists(candidate))
      patterns.push(candidate)
    else
      missing.push(cleaned)
  }

  patterns.push(...fromPackages)

  return { patterns, missing, exclude: [], withheld: [] }
}
