import type { CmsConfig } from '@stacksjs/types'

/**
 * **CMS Configuration**
 *
 * Controls the CMS feature bundle (Post, Page, Author, Comment, Tag,
 * Category models + content-edit dashboards). Flip `enabled` to `false`
 * to leave the bundle inert at boot. Manage via `./buddy cms:install` /
 * `./buddy cms:uninstall` rather than editing this file by hand.
 */
export default {
  enabled: true,
} satisfies CmsConfig
