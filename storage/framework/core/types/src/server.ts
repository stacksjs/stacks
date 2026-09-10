/**
 * Which requests the views server hands to the API process.
 *
 * In the split topology the views server answers stx page renders and forwards
 * everything else. It decided what "everything else" meant with a fixed rule -
 * the `/api/**` prefix, or a mutating verb - which made a plain `GET /health`
 * declared on the API process unreachable, and pushed URL design around an
 * internal deployment detail (stacksjs/stacks#2230).
 *
 * The route table cannot be consulted from the views process: it is registered
 * in the API process, which is a separate process under `buddy dev` and
 * potentially a separate host in production. So the app states it here, the way
 * a Next app states `rewrites()`.
 *
 * Note that stx runs its request hook BEFORE static file serving, so a path
 * listed here shadows a `public/` file of the same name.
 */
export interface ApiProxyOptions {
  /**
   * Extra path prefixes to forward. `/api/` is always forwarded and does not
   * need listing; anything here is in addition to it.
   *
   * @example ['/oauth/', '/webhooks/']
   */
  prefixes?: string[]

  /**
   * Exact paths to forward, whatever the verb.
   *
   * @example ['/health', '/me']
   */
  paths?: string[]

  /**
   * Verbs always forwarded, whatever the path.
   *
   * Defaults to `['POST', 'PUT', 'PATCH', 'DELETE']` - verbs that never match a
   * static page render. Setting this REPLACES the default, so include those
   * four unless you mean to stop forwarding them.
   */
  methods?: string[]
}

/**
 * **Server Options** - `config/server.ts`.
 *
 * How the views server behaves in the split views/API topology, shared by
 * `buddy dev` and `buddy serve`.
 */
/**
 * URLs the site used to have, and where they go now.
 *
 * A site that replaces an older one inherits its URLs, and a 301 is the only
 * thing that carries their standing in a search index across to the new page.
 * Keys are the old paths; values are either the new path or an object.
 *
 * ```ts
 * redirects: {
 *   '/old-page': '/new-page',
 *   '/summer-sale': { to: '/specials', status: 302 },
 *   '/docs': { to: 'https://docs.example.com', preserveQuery: false },
 * }
 * ```
 *
 * A rule written as `/section/*` claims that subtree, appending whatever
 * followed the prefix to the target. It is the one wildcard form: moving a
 * section whose pages are dynamic cannot be written as exact rules. An exact
 * rule always wins over a subtree one.
 *
 * Matching is otherwise exact on the path, ignoring a trailing slash. Rules are answered
 * before a page is looked for and before `public/` is searched, so a rule
 * shadows a static file of the same name — the same caveat as `proxy.paths`.
 * Anything under `/api/` is ignored.
 *
 * `buddy dev` prints the effective rules at boot.
 */
export type RedirectsOptions = Record<string, string | {
  /** Where to send the request. A path, or an absolute URL to leave the site. */
  to: string
  /** Defaults to 301. Use 302 for something genuinely temporary. */
  status?: number
  /** Carry the incoming query string onto the target. Defaults to true. */
  preserveQuery?: boolean
}>

/**
 * Paths the API process answers under a different path.
 *
 * `proxy.paths` forwards a path unchanged, which is enough when the API
 * registered that same URL. It is not enough when the public path and the
 * registered route differ — `routes/api.ts` carries an `/api` prefix, so a
 * handler whose home is the site root is registered at `/api/...` and the root
 * path 404s with nothing to say why.
 *
 * ```ts
 * rewrites: {
 *   '/sitemap.xml': '/api/sitemap.xml',
 *   '/sitemap-trails-*': '/api/sitemap-trails-*',
 *   '/.well-known/': '/api/well-known/',
 * }
 * ```
 *
 * Unlike a redirect this is invisible to the client: the request is answered
 * where it was made, so the URL a crawler indexes is the one it asked for. Use
 * a redirect when the URL genuinely moved, and a rewrite when it did not.
 *
 * A rule ending in `*` claims every path starting with it and appends the
 * remainder to the target — one rule for a chunked resource whose count
 * changes. An exact rule beats a prefix one; the longest prefix wins among
 * prefixes. Rules are answered before a page is looked for and before
 * `public/` is searched, so one shadows a static file of the same name.
 * A rewrite whose source is already under `/api/` is ignored.
 */
export type RewritesOptions = Record<string, string>

export interface ServerConfig {
  /** Which requests reach the API process. See {@link ApiProxyOptions}. */
  proxy?: ApiProxyOptions

  /** Old URLs and where they go now. See {@link RedirectsOptions}. */
  redirects?: RedirectsOptions

  /** Root paths the API serves under another path. See {@link RewritesOptions}. */
  rewrites?: RewritesOptions

  /** Security headers on rendered pages. See {@link ServerSecurityOptions}. */
  security?: ServerSecurityOptions
}

/** Security headers the views server puts on rendered pages. */
export interface ServerSecurityOptions {
  /**
   * Paths another origin is allowed to frame.
   *
   * `X-Frame-Options: SAMEORIGIN` is omitted for these; every other header
   * still applies. An entry ending in `/` is a prefix, anything else is an
   * exact path.
   */
  embeddable?: string[]
}

export interface ServerOptions {
  type?:
    | 'frontend'
    | 'backend'
    | 'api'
    | 'library'
    | 'desktop'
    | 'docs'
    | 'email'
    | 'admin'
    | 'system-tray'
    | 'database'
  host?: string
  port?: number
  open?: boolean
}
