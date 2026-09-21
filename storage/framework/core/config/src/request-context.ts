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
 * object built the same way.
 *
 * Both servers now supply the same reader too, {@link scopedRequestSnapshot},
 * because what they supplied before could answer with another request. Each
 * read a process-wide global: stx's `__stxServeContext` mirror, and globals
 * the servers' own `onRequest` hooks set. A global holds whichever request
 * assigned it last, so a script that read one after an `await`, or from a
 * layout, which stx renders after the page, could read another request. In
 * one run of core/buddy/tests/request-context-concurrency.test.ts, sixteen
 * storefront requests in flight, the header badged another visitor's cart on
 * 349 of 400 responses from `buddy serve` and 343 of 400 from `buddy dev`.
 * See {@link enterRequestScope}.
 *
 * Home of convenience: `@stacksjs/config` is the only package both the dev
 * server (`@stacksjs/actions`) and the production server (`@stacksjs/buddy`)
 * already depend on. It is not conceptually config, and moving it later is a
 * re-export away.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

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
 * Carried on the snapshot because `@stacksjs/sites`' own AsyncLocalStorage
 * context does not reach the render: both servers set it (`setCurrentSite`)
 * after the first `await` of their `onRequest` hook, and a scope entered there
 * ends with the hook (see {@link enterRequestScope}). A `<script server>`
 * block that asked `currentSite()` would get undefined. The resolving server
 * stores it on the snapshot {@link enterRequestScope} returned; pages read
 * `requestContext.site()`.
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
 * The request a server is rendering, for as long as it renders it.
 *
 * `own` is what the server read off the `Request`, plus what it resolves later
 * (the site, a locale). `published` is the object stx built for the same
 * render: see {@link scopeStxServeContext}.
 */
interface RequestScope {
  own: RequestContextSnapshot
  published?: RequestContextSnapshot
}

// Keyed on a process-global Symbol, as `@stacksjs/router` and `@stacksjs/sites`
// key theirs, so two physically distinct copies of this module in one process
// still share one store. With one copy, `??=` allocates exactly once.
const SCOPE_STORAGE_KEY = Symbol.for('stacks.config.requestScope')
const scopeStorage = ((globalThis as Record<symbol, unknown>)[SCOPE_STORAGE_KEY]
  ??= new AsyncLocalStorage<RequestScope>()) as AsyncLocalStorage<RequestScope>

/**
 * Open a scope for `request` and return its snapshot, for the server to add
 * the site or a locale to once it has resolved them.
 *
 * Call it FIRST in stx serve's `onRequest` hook, before the hook's first
 * `await`. stx calls the hook from the request's own async context and awaits
 * it before rendering, so a scope entered in the hook's synchronous prefix is
 * the one every `<script server>` of that render runs in: the page's, the
 * layout's and the components'. core/buddy/tests/request-context-concurrency
 * .test.ts sends 400 storefront requests, sixteen in flight, to each view
 * server and checks the page and the layout both read their own.
 *
 * Entered after an `await` in the hook, the scope reaches no script. The rest
 * of an async function runs in a context of its own, and stx resumes in the
 * one it called the hook from. The dev server entered its scope there, and
 * production-server.ts said it had tried the dev server's approach before
 * settling on globals, which is where "AsyncLocalStorage does not survive
 * into stx-serve's render" came from. request-scope.test.ts pins both
 * placements, and that a request that entered no scope reads none rather
 * than a neighbour's.
 */
export function enterRequestScope(request: Request): RequestContextSnapshot {
  const url = new URL(request.url)
  const own: RequestContextSnapshot = {
    cookies: parseCookieHeader(request.headers.get('cookie')),
    url: request.url,
    path: url.pathname,
    search: url.search,
    host: request.headers.get('host') ?? url.host,
    site: null,
  }

  scopeStorage.enterWith({ own })
  return own
}

/**
 * The request the caller is running inside, or undefined outside any scope.
 *
 * What stx published for the render wins, so `requestContext` answers what
 * stx hands the same render as bindings (route `params`, the client `ip`, its
 * locale, a CSRF cookie it minted). The server's own snapshot supplies the
 * site, which stx does not carry, and stands in for everything on a stx that
 * publishes nothing.
 *
 * Outside a scope there is no request, and every `requestContext` accessor
 * answers with its empty value. Nothing here falls back to a process-wide
 * value: that fallback is how one visitor saw another's cart.
 */
export function scopedRequestSnapshot(): RequestContextSnapshot | undefined {
  const scope = scopeStorage.getStore()
  if (!scope)
    return undefined

  const { own, published } = scope
  if (!published)
    return own

  return { ...own, ...published, site: own.site ?? published.site ?? null }
}

const STX_SERVE_CONTEXT = '__stxServeContext'

/**
 * Keep stx's `__stxServeContext` mirror per request.
 *
 * stx serve assigns the request it is about to render to
 * `globalThis.__stxServeContext` (`injectServeRequestContext` in
 * bun-plugin-stx's serve), once per render, before the page's server
 * scripts. As a plain global it holds whichever render assigned it last. The
 * assignment runs inside the rendering request's async context, so this turns
 * the global into an accessor that files the value under that request's scope
 * and reads back the reader's own.
 *
 * It is what carries route `params`, the client `ip` and stx's locale into
 * {@link scopedRequestSnapshot}: `onRequest` runs before stx matches the route,
 * and is not handed the server stx reads the address from.
 *
 * An assignment made outside any scope is kept for readers outside one, as
 * the plain global kept it. A reader inside a scope only ever gets its own.
 */
export function scopeStxServeContext(): void {
  const existing = Object.getOwnPropertyDescriptor(globalThis, STX_SERVE_CONTEXT)
  if (existing?.get)
    return

  let unscoped = existing?.value as RequestContextSnapshot | undefined
  Object.defineProperty(globalThis, STX_SERVE_CONTEXT, {
    configurable: true,
    enumerable: false,
    get: () => {
      const scope = scopeStorage.getStore()
      return scope ? scope.published : unscoped
    },
    set: (value: RequestContextSnapshot | undefined) => {
      const scope = scopeStorage.getStore()
      if (scope)
        scope.published = value
      else
        unscoped = value
    },
  })
}

/**
 * What both servers install at boot: `requestContext`, reading the scope of
 * the request each script runs in.
 *
 * One call rather than the pieces, so neither server can scope stx's mirror
 * and forget the reader, or the reverse. The other half is
 * {@link enterRequestScope}, first in each server's `onRequest`.
 */
export function installRequestScope(): StacksRequestContext {
  scopeStxServeContext()
  return installRequestContext(scopedRequestSnapshot)
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
