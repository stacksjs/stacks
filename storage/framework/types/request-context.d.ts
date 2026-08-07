// Hand-written, unlike its neighbours — `server-auto-imports.d.ts` is
// regenerated whenever the API starts and would lose these.
//
// What a `<script server>` block can reach (stacksjs/stacks#2232). tsc cannot
// see inside a `.stx` file, so these do not check the templates themselves;
// they give an editor something to complete against, and they give the two
// server implementations one written-down contract instead of two `as any`
// installers that drifted twice into production.

export {}

declare global {
  /**
   * The request in flight, published by whichever server booted.
   *
   * Always present under `buddy dev` and `buddy serve`. A standalone or SSG
   * render has no request, and every accessor answers with its empty value
   * rather than throwing — so a page may call these unguarded.
   */
  const requestContext: {
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
  }

  /**
   * Query parameters injected onto the render context by the serve path.
   *
   * Declared optional-shaped for a reason: unlike `requestContext`, this is
   * injected by bun-plugin-stx's serve path only. A standalone render (the SSG
   * path, or `processDirectives` called without a request) supplies nothing, and
   * a bare `query` is a ReferenceError there rather than an empty result. Until
   * that path injects an empty-but-shaped object, reads still need a guard:
   *
   *     const params = typeof query !== 'undefined' ? query : {}
   *
   * `requestContext.query()` has no such caveat and is the safer spelling.
   */
  const query: Record<string, string>

  /**
   * Cookies injected onto the render context by the serve path.
   *
   * Same caveat as `query` — absent in a standalone render.
   * `requestContext.cookie(name)` is the safer spelling.
   */
  const cookies: Record<string, string>
}
