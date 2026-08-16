/**
 * Per-request site context, for the API (bun-router) side of the app.
 *
 * Backed by AsyncLocalStorage keyed on a process-global Symbol - the same
 * dual-module-copy defense `@stacksjs/router`'s request context uses: if two
 * physically distinct copies of this package load in one process, context set
 * by one is visible to the other.
 *
 * IMPORTANT: this does NOT reach `<script server>` blocks. ALS does not
 * survive into stx-serve's render; pages read `requestContext.site()` from the
 * request-context snapshot instead (`@stacksjs/config`). The serving layer
 * carries the same value into both places.
 */

import type { SiteContext } from './types'
import { AsyncLocalStorage } from 'node:async_hooks'

const SITE_STORAGE_KEY = Symbol.for('stacks.sites.contextStorage')
const siteStorage = ((globalThis as Record<symbol, unknown>)[SITE_STORAGE_KEY]
  ??= new AsyncLocalStorage<SiteContext | null>()) as AsyncLocalStorage<SiteContext | null>

/**
 * Thrown when a handler that only makes sense on a tenant site runs without
 * one - an unknown host, or a platform host hitting a site-only route.
 * Carries `status: 404` so the router's error mapping answers Not Found
 * rather than 500: an unknown host is the visitor's dead end, not our bug.
 */
export class SiteNotResolvedError extends Error {
  readonly status = 404
  constructor(message = 'Unknown site') {
    super(message)
    this.name = 'SiteNotResolvedError'
  }
}

/** Run `fn` with `site` as the ambient site context. */
export function runWithSite<T>(site: SiteContext | null, fn: () => T): T {
  return siteStorage.run(site, fn)
}

/**
 * Set the ambient site for the remainder of the current async scope.
 *
 * For middleware pipelines that cannot wrap the downstream handler in a
 * callback. `enterWith` binds to the current execution context, which the
 * router's per-request scope already isolates.
 */
export function setCurrentSite(site: SiteContext | null): void {
  siteStorage.enterWith(site)
}

/** The resolved site, or undefined outside any site scope (jobs, CLI, platform hosts). */
export function currentSite(): SiteContext | undefined {
  return siteStorage.getStore() ?? undefined
}

/** The resolved site's id, or undefined. */
export function currentSiteId(): number | undefined {
  return currentSite()?.id
}

/**
 * The resolved site, or throw 404.
 *
 * The route boundary calls this exactly once and passes `site.id` down
 * explicitly - data-layer functions take `siteId` as a required argument
 * rather than defaulting to ambient context, so a forgotten scope is a
 * compile error, not a cross-tenant query.
 */
export function requireSite(): SiteContext {
  const site = currentSite()
  if (!site)
    throw new SiteNotResolvedError()
  return site
}
