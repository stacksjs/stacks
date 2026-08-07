import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Whether an app serves the framework's default views, and which of them.
 *
 * `true` (the default) keeps every default view registered, which is the
 * behaviour every existing app already has. `false` registers the app's own
 * views only. An array registers just the named subtrees of the defaults
 * directory — `['errors', 'emails']` for an app that wants the error pages and
 * the mail previews but not the demo storefront.
 */
export type DefaultViewsSetting = boolean | string[]

export interface ViewPatternResolution {
  /** What to hand stx as `patterns`, in precedence order (app views first). */
  patterns: string[]
  /**
   * Names listed in the config that do not exist under the defaults directory.
   * Reported rather than silently dropped: a typo would otherwise read as
   * "that subtree is turned off", which is indistinguishable from working.
   */
  missing: string[]
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
 */
export function resolveViewPatterns(
  userViewsPath: string,
  defaultViewsPath: string,
  setting: DefaultViewsSetting | undefined,
  exists: (path: string) => boolean = existsSync,
): ViewPatternResolution {
  // Absent means unset, which must keep behaving exactly as before. Only an
  // explicit `false` or a list opts out.
  if (setting === undefined || setting === true)
    return { patterns: [userViewsPath, defaultViewsPath], missing: [] }

  if (setting === false)
    return { patterns: [userViewsPath], missing: [] }

  if (!Array.isArray(setting))
    return { patterns: [userViewsPath, defaultViewsPath], missing: [] }

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

  return { patterns, missing }
}
