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
   * Matching is exact on the path, ignoring a trailing slash, and the query
   * string is carried over unless you say otherwise. Rules are answered before
   * a page is looked for and before `public/` is searched, so — as with
   * `proxy.paths` — a rule shadows a static file of the same name. Anything
   * under `/api/` is ignored, and a rule pointing at itself is dropped rather
   * than looping the browser.
   *
   * `buddy dev` prints the effective rules at boot.
   */
  redirects: {},
} satisfies ServerConfig
