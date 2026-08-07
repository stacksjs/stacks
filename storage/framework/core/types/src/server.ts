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
export interface ServerConfig {
  /** Which requests reach the API process. See {@link ApiProxyOptions}. */
  proxy?: ApiProxyOptions
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
