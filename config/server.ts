import type { ServerConfig } from '@stacksjs/types'

/**
 * **Server Configuration**
 *
 * This configuration defines how the views server behaves in the split
 * views/API topology, shared by `buddy dev` and `buddy serve`. Because Stacks
 * is fully-typed, you may hover any of the options below and the definitions
 * will be provided. In case you have any questions, feel free to reach out via
 * Discord or GitHub Discussions.
 */
export default {
  /**
   * **API Proxy**
   *
   * The views server renders stx pages and forwards everything else to the API
   * process. By default "everything else" means the `/api/**` prefix plus the
   * mutating verbs (POST/PUT/PATCH/DELETE), which never match a page render.
   *
   * A plain `GET` route declared at the root on the API process is therefore
   * not reachable unless you say so here. That is what these options are for:
   *
   * ```ts
   * proxy: {
   *   paths: ['/health', '/me'],
   *   prefixes: ['/oauth/'],
   * }
   * ```
   *
   * `buddy dev` prints the effective rules at boot, so you can see what will
   * be forwarded without guessing at a 404.
   *
   * One caveat worth knowing before you add a path: stx runs its request hook
   * before static file serving, so a path listed here shadows a `public/` file
   * of the same name. Listing `/script.js` makes `public/script.js`
   * unreachable.
   */
  proxy: {
    prefixes: [],
    paths: [],
  },

  /**
   * **Redirects**
   *
   * Old URLs and where they go now. Every site that replaces an older one
   * inherits its URLs — they are in search indexes, in other people's links,
   * and on printed material — and a 301 is the only thing that carries their
   * standing across to the new page.
   *
   * ```ts
   * redirects: {
   *   '/old-page': '/new-page',
   *   '/summer-sale': { to: '/specials', status: 302 },
   *   '/docs': { to: 'https://docs.example.com', preserveQuery: false },
   * }
   * ```
   *
   * A rule written as `/section/*` claims that subtree instead, appending
   * whatever followed the prefix to the target — `'/dashboard/*':
   * 'https://dash.example.com'` sends `/dashboard/events/42` to
   * `https://dash.example.com/events/42`. It is the one wildcard form there
   * is: moving a section whose pages are dynamic cannot be written as a list
   * of exact rules. An exact rule always wins over a subtree one.
   *
   * Matching is otherwise exact on the path, ignoring a trailing slash, and the query
   * string is carried over unless you say otherwise. Rules are answered before
   * a page is looked for and before `public/` is searched, so — as with
   * `proxy.paths` — a rule shadows a static file of the same name. Anything
   * under `/api/` is ignored, and a rule pointing at itself is dropped rather
   * than looping the browser.
   *
   * `buddy dev` prints the effective rules at boot.
   */
  redirects: {},

  /**
   * **Security headers**
   *
   * Rendered pages carry `X-Frame-Options: SAMEORIGIN`,
   * `X-Content-Type-Options: nosniff` and
   * `Referrer-Policy: strict-origin-when-cross-origin`, the same three the
   * API already sent. None of them can be set from a template:
   * `X-Frame-Options` has no `<meta>` equivalent, and CSP `frame-ancestors`
   * is ignored when set that way.
   *
   * `embeddable` lists the paths another origin is allowed to frame. Those
   * paths omit `X-Frame-Options` and keep everything else:
   *
   * ```ts
   * security: {
   *   embeddable: ['/embed/', '/share/card'],
   * }
   * ```
   *
   * An entry ending in `/` is a prefix, anything else is an exact path.
   * `buddy dev` and `buddy serve` both print the list at boot, because a page
   * that can be framed is a deliberate exception worth seeing.
   *
   * Two headers are deliberately NOT sent on pages. A `STACKS_CSP` policy is
   * not, because it has only ever reached JSON responses and a blanket policy
   * breaks inline stx script bootstrapping, Stripe iframes and OAuth popups.
   * `Strict-Transport-Security` is not, because `buddy serve` treats itself as
   * production even on a laptop, and HSTS on localhost pins that host to
   * HTTPS in your browser for a year.
   *
   * `STACKS_SECURITY_HEADERS_DISABLE=true` turns the whole set off, for a
   * deployment behind a proxy that injects its own.
   */
  security: {
    embeddable: [],
  },
} satisfies ServerConfig
