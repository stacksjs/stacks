import type { StxOptions as UiOptions } from '@stacksjs/stx'

/**
 * STX Configuration for Stacks
 * Note: Dashboard mode overrides these settings via serve() options
 */

export default {
  // Where stx keeps everything it generates: the compiled-template cache, the
  // Crosswind CSS cache, client-script bundles, the route manifest and route
  // types. Stacks keeps every runtime-owned directory under storage/ rather
  // than a `.stx` in the project root - see `stxPath()` in @stacksjs/path,
  // which also exports this as STX_DIR for processes that never read a config.
  stateDir: 'storage/framework/stx',

  // Components, layouts and partials directories.
  //
  // These are resolved RELATIVE TO the stx root, which auto-detects as
  // `resources` in a Stacks app (it is the directory holding `views/` and
  // `layouts/`). Spelling them `resources/components` here made stx join the
  // root on a second time and look in `resources/resources/components`, so
  // `<Card />` in a template resolved to nothing and stx warned on every boot.
  componentsDir: 'components',

  // Expose @stacksjs/components' ui library (<Sidebar>, <Button>, ...)
  // to tag resolution everywhere — the dashboard's macOS-style sidebar
  // resolves through this. See the plugin file for the lookup order.
  plugins: ['./storage/framework/defaults/stx-components-plugin.ts'],

  layoutsDir: 'layouts',

  partialsDir: 'partials',
// `plugins` landed in stx after the pinned @stacksjs/stx types — widen until the dep updates.
} satisfies UiOptions & { plugins?: string[] }
