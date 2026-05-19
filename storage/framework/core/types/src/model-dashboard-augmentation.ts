/**
 * Module augmentation that adds the Stacks-specific `dashboard` slot to
 * bun-query-builder's `BrowserModelDefinition`.
 *
 * Why this lives here (Stacks, not bqb):
 *
 *   The `dashboard` config is a Stacks framework concept — it influences
 *   how the model appears in `buddy dev --dashboard`'s sidebar. It has no
 *   meaning outside the dashboard surface, so adding it to bqb's core
 *   types would force every bqb consumer to carry weight they don't need.
 *
 * Declaration merging keeps the typing clean at every call site:
 *
 *   ```ts
 *   import { defineModel } from '@stacksjs/orm'
 *
 *   defineModel({
 *     name: 'AuditLog',
 *     dashboard: { section: 'management', roles: ['admin'] }, // ← typed
 *     attributes: { … },
 *   })
 *   ```
 *
 * Without this augmentation, the `dashboard` property would still pass
 * (because bqb's `defineModel<TDef extends BrowserModelDefinition>` uses
 * `extends`, which permits excess properties), but with no autocomplete
 * and no shape validation. The augmentation gives both.
 *
 * Loading note: this file only declares types — no runtime effects. It
 * must be reachable via `@stacksjs/types`' barrel so any package that
 * already imports from `@stacksjs/types` picks up the augmentation in
 * the same compilation. Re-exported from `index.ts`.
 */

import type { DashboardModelOptions } from './dashboard'

declare module 'bun-query-builder' {
  interface BrowserModelDefinition {
    /**
     * Stacks dashboard sidebar configuration for this model.
     * See {@link DashboardModelOptions} for the full shape.
     *
     * Omit to use defaults (model is shown under its auto-categorised
     * section using `iconMap` + the model name).
     */
    readonly dashboard?: DashboardModelOptions
  }
}

// Re-export for `import type { DashboardModelOptions } from '@stacksjs/types'`.
export type { DashboardModelOptions }
