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
} satisfies ServerConfig
