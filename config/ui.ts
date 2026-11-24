import type { UiConfig } from '@stacksjs/types'
import app from './app'

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
  // ts-css CSS cache, client-script bundles, the route manifest and route
  // types. Stacks keeps every runtime-owned directory under storage/ rather
  // than a `.stx` in the project root - see `stxPath()` in @stacksjs/path,
  // which also exports this as STX_DIR for processes that never read a config.
  stateDir: 'storage/framework/stx',

  // The utility and icon CSS stx generates for a page goes into the document
  // itself while it is under this many bytes, instead of into a stylesheet
  // the browser has to fetch before it may paint. On the marketing pages that
  // sheet is almost entirely icons (each `i-hugeicons-*` class is an inline
  // SVG mask) and was the last render-blocking request they made: with it
  // inline, a first visit paints from one response. A page whose sheet is
  // larger than this - the dashboard's - keeps the linked, immutably cached
  // file, where a long-lived cache is worth more than one saved round trip.
  inlineGeneratedCssBytes: 200_000,

  // A page whose only reactive parts are islands paints without the signals
  // runtime: the first island a visitor touches loads it. On stacksjs.com the
  // signup form is the only one, and it posts without JavaScript anyway, so
  // the home page and the blog no longer fetch 69 KB before their first paint.
  lazyIslandRuntime: true,

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

  // `resources/views/layouts`, beside the pages that extend them, which is
  // where the scaffold puts `default.stx`. One directory is scanned, not two: a
  // layout kept in `resources/layouts` is found only by an app that has no
  // `resources/views/layouts` at all, and "Layout not found" lists the
  // directories that were searched.
  layoutsDir: 'views/layouts',

  partialsDir: 'partials',

  // Whether this app serves the framework's default views: the auth pages
  // (/login, /register, /forgot-password, /password/reset/:token,
  // /auth/magic/:token), a demo storefront (/cart, /checkout/*, /orders/:id),
  // the error pages and the mail previews. Left unset, each page is served
  // only while the route bundle it posts to is mounted (STACKS_DEFAULT_ROUTES):
  // the auth pages with `auth`, the storefront with `dashboard`. `true` serves
  // all of them whatever is mounted; `false` serves only `resources/views`; an
  // array names the subtrees to keep, e.g. `['errors', 'emails']`. Applies to
  // `buddy dev` and `buddy serve` alike, and to the sitemap.
  // defaultViews: true,

  // What stx falls back to for a page that writes no title or description of
  // its own. Without these it is stx's own placeholders: "stx App" as the
  // title of a page it wraps in a document, and "stx Project" / "A website
  // built with stx templating engine" in every social-preview tag.
  defaultTitle: app.name,
  app: {
    head: { title: app.name },
  },
  seo: {
    enabled: true,
    socialPreview: true,
    defaultConfig: {
      title: app.name,
      description: app.description || app.name,
    },
  },
} satisfies UiConfig
