/**
 * One request object for `<script server>` blocks (stacksjs/stacks#2232).
 *
 * `requestContext` was installed twice — once by the dev views server, once by
 * the production server — with two different backings, two different sets of
 * methods, and no shared type. Both installers were `(globalThis)`, so
 * nothing could catch a divergence. Two already shipped:
 *
 *   - production's `url()` returned only the query string, so a page doing
 *     `new URL(requestContext.url())` worked in dev and threw on the box
 *   - production had no `locale()` at all, so a page that branched on locale
 *     threw "requestContext.locale is not a function" on the box
 *
 * Both were found by an end-to-end test, not by inspection, because there was
 * nothing to inspect against.
 *
 * A shared TYPE would only have made those detectable. A shared FACTORY makes
 * them impossible: each server supplies a snapshot reader and gets the same
 * object built the same way. The only thing a server still chooses is where
 * the snapshot comes from, which is the one thing that genuinely differs (dev
 * has AsyncLocalStorage available; production established it does not survive
 * into stx-serve's render).
 *
 * Home of convenience: `@stacksjs/config` is the only package both the dev
 * server (`@stacksjs/actions`) and the production server (`@stacksjs/buddy`)
 * already depend on. It is not conceptually config, and moving it later is a
 * re-export away.
 */

/**
 * What a server knows about the request in flight.
 *
 * Every field optional: a snapshot is assembled by whichever server booted, an
 * older stx may not populate all of them, and a standalone or SSG render has no
 * request at all. Readers below supply a shaped empty value rather than
 * throwing, so a page never needs `typeof requestContext !== 'undefined'`.
 */
export interface RequestContextSnapshot {
  cookies?: Record<string, string>
  url?: string
  path?: string
  search?: string
  locale?: string | null
  params?: Record<string, string>
  ip?: string
  host?: string
  site?: SiteSnapshot | null
}

/**
 * The site a multi-site server resolved for this request's Host header.
 *
 * Carried on the snapshot rather than AsyncLocalStorage because ALS does not
 * survive into stx-serve's render (see the module comment): a `<script server>`
 * block that asked an ALS-backed `currentSite()` would silently get undefined.
 * The resolving server (`@stacksjs/sites` middleware / onRequest hook) stashes
 * it here; pages read `requestContext.site()`.
 */
export interface SiteSnapshot {
  id: number
  uuid?: string
  name?: string
  subdomain?: string
  settings?: Record<string, unknown>
}

/** What a `<script server>` block sees as `requestContext`. */
export interface StacksRequestContext {
  /** One cookie by name, or null. */
  cookie: (name: string) => string | null
  /** Every cookie on the request. */
  cookies: () => Record<string, string>
  /** The full request URL. Safe to hand to `new URL()`. */
  url: () => string
  /** Path only, no query. */
  path: () => string
  /** Query string including the leading `?`, or ''. */
  search: () => string
  /** Query parameters, parsed. */
  query: () => Record<string, string>
  /** Route parameters for the matched page. */
  params: () => Record<string, string>
  /** Resolved locale, defaulting to 'en'. */
  locale: () => string
  /** Client IP, or '' when the server did not resolve one. */
  ip: () => string
  /** Host header, or ''. */
  host: () => string
  /** The site resolved for this request's host, or null on a single-site app. */
  site: () => SiteSnapshot | null
}

/**
 * Parse a `Cookie` header into a record.
 *
 * Was copy-pasted into both servers; identical in both, which is the mild case
 * of the same problem this module exists to fix.
 */
export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header)
    return out

  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1)
      continue

    const key = trimmed.slice(0, eq).trim()
    if (!key)
      continue

    const value = trimmed.slice(eq + 1).trim()
    try {
      out[key] = decodeURIComponent(value)
    }
    catch {
      // A malformed percent-escape is the sender's problem, not a reason to
      // drop the cookie — keep the raw value.
      out[key] = value
    }
  }

  return out
}

/**
 * Build the object both servers publish as `globalThis.requestContext`.
 *
 * `read` is called per access rather than captured, because the snapshot is
 * replaced between requests — capturing it would pin the first request's
 * cookies onto every later one.
 */
export function createRequestContext(read: () => RequestContextSnapshot | undefined): StacksRequestContext {
  const snapshot = (): RequestContextSnapshot => read() ?? {}

  const searchOf = (): string => {
    const direct = snapshot().search
    if (direct)
      return direct

    // Derived rather than required: an older stx snapshot carries only `url`.
    const url = snapshot().url ?? ''
    const mark = url.indexOf('?')
    return mark === -1 ? '' : url.slice(mark)
  }

  return {
    cookie: (name: string) => snapshot().cookies?.[name] ?? null,
    cookies: () => snapshot().cookies ?? {},

    // The FULL url. Production used to return the query string here, which is
    // why `new URL(requestContext.url())` threw on the box and nowhere else.
    url: () => snapshot().url ?? '',

    path: () => {
      const direct = snapshot().path
      if (direct)
        return direct

      const url = snapshot().url ?? ''
      if (!url)
        return ''

      try {
        return new URL(url).pathname
      }
      catch {
        // Relative url: everything up to the query is the path.
        const mark = url.indexOf('?')
        return mark === -1 ? url : url.slice(0, mark)
      }
    },

    search: searchOf,

    query: () => {
      const out: Record<string, string> = {}
      const search = searchOf()
      if (!search)
        return out

      new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
        .forEach((value, key) => { out[key] = value })

      return out
    },

    params: () => snapshot().params ?? {},

    // 'en' rather than the framework's configured default: this is what a page
    // sees when the request carried no locale at all, and guessing a non-English
    // one would be worse than saying so.
    locale: () => snapshot().locale ?? 'en',

    ip: () => snapshot().ip ?? '',
    host: () => snapshot().host ?? '',
    site: () => snapshot().site ?? null,
  }
}

/**
 * Install the context as the `requestContext` global and return it.
 *
 * Both servers call exactly this, so neither can publish a differently-shaped
 * object by accident.
 */
export function installRequestContext(read: () => RequestContextSnapshot | undefined): StacksRequestContext {
  const context = createRequestContext(read)
  ;(globalThis as { requestContext?: StacksRequestContext }).requestContext = context
  return context
}

/**
 * The single accessor (#2232 ask 4), for callers who would rather have one
 * object than reach for ambient globals.
 *
 * Always returns something: with no request in flight every field is its empty
 * value, so a standalone or SSG render reads `useRequestEvent().query.site` and
 * gets `undefined` instead of a ReferenceError.
 */
export function useRequestEvent(): {
  url: string
  path: string
  search: string
  query: Record<string, string>
  cookies: Record<string, string>
  params: Record<string, string>
  locale: string
  ip: string
  host: string
  site: SiteSnapshot | null
} {
  const context = (globalThis as { requestContext?: StacksRequestContext }).requestContext
    ?? createRequestContext(() => undefined)

  return {
    url: context.url(),
    path: context.path(),
    search: context.search(),
    query: context.query(),
    cookies: context.cookies(),
    params: context.params(),
    locale: context.locale(),
    ip: context.ip(),
    host: context.host(),
    site: context.site(),
  }
}
