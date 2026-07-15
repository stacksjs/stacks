import type { StxOptions as UiOptions } from '@stacksjs/stx'

/**
 * STX Configuration for Stacks
 * Note: Dashboard mode overrides these settings via serve() options
 */

export default {
  // Components directory - for user-defined components
  componentsDir: 'resources/components',

  // Expose @stacksjs/components' ui library (<Sidebar>, <Button>, ...)
  // to tag resolution everywhere — the dashboard's macOS-style sidebar
  // resolves through this. See the plugin file for the lookup order.
  plugins: ['./storage/framework/defaults/stx-components-plugin.ts'],

  // Layouts directory - for layout templates
  layoutsDir: 'resources/layouts',

  // Partials directory - for partial templates
  partialsDir: 'resources/partials',
// `plugins` landed in stx after the pinned @stacksjs/stx types — widen until the dep updates.
} satisfies UiOptions & { plugins?: string[] }
