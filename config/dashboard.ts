import type { DashboardConfig } from '@stacksjs/types'

/**
 * **Dashboard Configuration**
 *
 * Controls which sections render in the `buddy dev --dashboard` sidebar.
 * Each section defaults to enabled — flip a flag to `false` here to hide
 * a section that this project doesn't use.
 *
 * Common case: a non-commerce app removes the Commerce section (and the
 * commerce-categorized model rows that would otherwise appear under it)
 * by setting `commerce.enabled: false`.
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
  },
} satisfies DashboardConfig
