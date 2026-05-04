import type { DashboardConfig } from '@stacksjs/types'

/**
 * **Dashboard Configuration**
 *
 * Controls which sections render in the `buddy dev --dashboard` sidebar.
 * Each section defaults to enabled — flip a flag to `false` here to hide
 * a section that this project doesn't use.
 *
 * Common cases:
 *
 *   • A non-commerce app removes the Commerce section (and its categorized
 *     model rows) by setting `commerce.enabled: false`.
 *
 *   • A project with no newsletter hides the built-in Subscribers row in
 *     the Data section by setting `data.subscribers.enabled: false`. The
 *     Data section itself stays — that's where every userland model under
 *     `app/Models/` is auto-listed, and you always want to see those.
 */
export default {
  sections: {
    library: { enabled: true },
    content: { enabled: true },
    commerce: { enabled: true },
    marketing: { enabled: true },
    analytics: { enabled: true },
    management: { enabled: true },
    utilities: { enabled: true },
    data: {
      // Basic built-in rows. Disable any you don't need; your userland
      // models in `app/Models/` always appear regardless of these flags.
      dashboard: { enabled: true },
      activity: { enabled: true },
      users: { enabled: true },
      teams: { enabled: true },
      subscribers: { enabled: true },
      allModels: { enabled: true },
    },
  },
} satisfies DashboardConfig
