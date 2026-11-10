import type { CmsConfig } from '@stacksjs/types'

/**
 * **CMS Configuration**
 *
 * Controls the CMS feature bundle (Post, Page, Author, Comment, Tag,
 * Category models + content-edit dashboards).
 *
 * **Off by default**, like commerce: most applications do not need a content
 * system, and one that is off is not in the dashboard, its routes are not
 * mounted and its tables are not migrated. The markdown blog under
 * `content/blog/` does not depend on it. Turn it on with
 * `./buddy cms:install`.
 *
 * Flipping `enabled` back to `false` later leaves the bundle inert at boot and
 * KEEPS the tables you already have: the migrations that created them are
 * hidden from subsequent runs, not reversed. Manage via `./buddy cms:install`
 * / `./buddy cms:uninstall` rather than editing this file by hand.
 */
export default {
  enabled: false,
} satisfies CmsConfig
