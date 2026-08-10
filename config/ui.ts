import type { StxOptions as UiOptions } from '@stacksjs/stx'

/**
 * STX Configuration for Stacks
 * Note: Dashboard mode overrides these settings via serve() options
 */

export default {
  // Pin template topology to the application resources directory. This keeps
  // component, layout and partial resolution stable for CLI, dev and build
  // processes instead of asking each process to infer the same root.
  root: 'resources',

  // Where stx keeps everything it generates: the compiled-template cache, the
  // Crosswind CSS cache, client-script bundles, the route manifest and route
  // types. Stacks keeps every runtime-owned directory under storage/ rather
  // than a `.stx` in the project root - see `stxPath()` in @stacksjs/path,
  // which also exports this as STX_DIR for processes that never read a config.
  stateDir: 'storage/framework/stx',

  // Components, layouts and partials directories.
  //
  // These are resolved RELATIVE TO the explicit `resources` stx root.
  // Spelling them `resources/components` here made stx join the
  // root on a second time and look in `resources/resources/components`, so
  // `<Card />` in a template resolved to nothing and stx warned on every boot.
  componentsDir: 'components',

  // Expose @stacksjs/components' ui library (<Sidebar>, <Button>, ...)
  // to tag resolution everywhere — the dashboard's macOS-style sidebar
  // resolves through this. See the plugin file for the lookup order.
  plugins: ['./storage/framework/defaults/stx-components-plugin.ts'],

  layoutsDir: 'layouts',

  partialsDir: 'partials',

  // Whether this app serves the framework's default views, which include a
  // demo storefront (/cart, /checkout/*, /orders/:id) alongside the error
  // pages and mail previews. `true` serves all of them and is the historical
  // behaviour; `false` serves only `resources/views`; an array names the
  // subtrees to keep, e.g. `['errors', 'emails']`. Applies to `buddy dev` and
  // `buddy serve` alike, and to whatever the route manifest enumerates into
  // the sitemap.
  defaultViews: true,
// `plugins` landed in stx after the pinned @stacksjs/stx types — widen until the dep updates.
} satisfies UiOptions & { plugins?: string[], defaultViews?: boolean | string[] }
