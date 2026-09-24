import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Everything in the template that belongs to stacksjs.com rather than to an
 * app, relative to the project root.
 *
 * `buddy new` scaffolds by downloading this repository, and this repository IS
 * stacksjs.com: its `resources/` and `public/` hold the marketing site, its
 * brand fonts, logos and park illustrations, and a desktop-OS demo; `docs/`
 * and `content/blog/` are its documentation and blog. Left in place, a new app
 * deployed as-is publishes a canonical URL and an Organization graph claiming
 * to be stacksjs.com, the framework's docs and launch posts as its own, and
 * carries several MB of someone else's brand.
 *
 * An explicit list rather than moving the site elsewhere: the stacks repo keeps
 * serving stacksjs.com from the paths every app uses, so its deploy does not
 * change. `scaffold-site.test.ts` runs this against the repository's real tree
 * and fails on anything the list misses, which is what keeps it complete when
 * the site grows a page.
 */
export const SITE_ONLY_PATHS: readonly string[] = [
  // The marketing site: pages, their data and their shared partials.
  'resources/views/index.stx',
  'resources/views/coming-soon.stx',
  'resources/views/compare',
  'resources/views/features',
  'resources/views/use-cases',
  'resources/views/components/FeatureCard.stx',
  'resources/views/layouts/marketing.stx',
  'resources/views/partials/theme.stx',
  'resources/data/comparisons.ts',
  'resources/data/features.ts',
  'resources/data/highlight.ts',
  'resources/data/nav.ts',
  'resources/data/use-cases.ts',
  'resources/partials/marketing-footer.stx',
  'resources/partials/marketing-head.stx',
  'resources/partials/marketing-nav.stx',
  'resources/partials/marketing-theme-toggle.stx',
  'resources/emails/subscription-confirmation.stx',
  'resources/assets/scripts/site-mode.js',
  'public/assets/styles/marketing.css',
  'public/assets/styles/theme.css',

  // The brand: NPS type and park illustrations. The framework's own blog and
  // maintenance pages read theirs from `defaults/resources/assets`, not these.
  'resources/assets/fonts/nps',
  'public/assets/fonts/nps',
  'public/assets/images',
  'resources/assets/images/bg-img.png',
  'resources/assets/images/marketing-park-camp.svg',
  'resources/assets/images/marketing-park-geyser.svg',
  'resources/assets/images/marketing-park-lighthouse.svg',
  'resources/assets/images/marketing-park-trail.svg',
  'resources/assets/images/marketing-park-wing.svg',
  'resources/assets/images/park-ridge.svg',
  'resources/assets/images/river.svg',
  'resources/assets/images/topography.svg',
  'resources/assets/images/wood-sign.svg',

  // stacksjs.com's documentation and blog. `buddy deploy` builds `docs/` and
  // `content/blog/` when they exist, so left in place an app published the
  // framework's docs and launch posts as its own. An app that wants either
  // creates the directory; `config/docs.ts` and `config/blog.ts` are ready.
  'docs',
  'content/blog',
  'content/BLOG_STRATEGY.md',

  // Marketing images and logos only stacksjs.com uses. What stays in
  // public/images is what the framework's own pages reference: the favicons
  // (dashboard layouts) and the Marketing components' backgrounds, avatars
  // and screenshots.
  'public/images/atomic-fx-diagram.png',
  'public/images/atomic-ui-diagram.png',
  'public/images/diagram.png',
  'public/images/og-image.png',
  'public/images/social.png',
  'public/images/background-auth.jpg',
  'public/images/background-features.jpg',
  'public/images/screenshots/expenses.webp',
  'public/images/screenshots/reporting.webp',
  'public/images/screenshots/vat-returns.webp',
  'public/images/logos/amex.jpg',
  'public/images/logos/jcb.svg',
  'public/images/logos/laravel.svg',
  'public/images/logos/logo-dark.svg',
  'public/images/logos/logo-mini.svg',
  'public/images/logos/logo-transparent.svg',
  'public/images/logos/logo-white.png',
  'public/images/logos/logo.png',
  'public/images/logos/logo.svg',
  'public/images/logos/mastercard.svg',
  'public/images/logos/meilisearch.svg',
  'public/images/logos/mirage.svg',
  'public/images/logos/statamic.svg',
  'public/images/logos/statickit.svg',
  'public/images/logos/transistor.svg',
  'public/images/logos/tuple.svg',
  'public/images/logos/visa.png',
  'public/images/logos/visa.svgz',

  // The desktop-OS demo.
  'resources/assets/scripts/main.ts',
  'resources/assets/styles/main.css',
  'resources/layouts/Desktop.stx',
  'resources/partials/welcome-pdf-content.stx',
  'resources/partials/welcome-pdf-toolbar.stx',
  'resources/components/ContextMenu.stx',
  'resources/components/ContextMenuItem.stx',
  'resources/components/DesktopIcon.stx',
  'resources/components/FeatureButton.stx',
  'resources/components/InputGroup.stx',
  'resources/components/LoginForm.stx',
  'resources/components/LoginScreen.stx',
  'resources/components/NotificationPopup.stx',
  'resources/components/PackageItem.stx',
  'resources/components/StartMenu.stx',
  'resources/components/StartMenuItem.stx',
  'resources/components/Taskbar.stx',
  'resources/components/Window.stx',
]

/** Where the app's own starter files live in the template, relative to the project root. */
export const APP_SITE_TEMPLATE = 'storage/framework/defaults/scaffold/resources'

/**
 * Replace the stacksjs.com site with a neutral starter: delete every
 * site-only path, then lay `defaults/scaffold/resources` over `resources/`.
 *
 * Directories the removal empties are removed too, so the app does not start
 * with an empty `resources/data/` it has no use for.
 *
 * Returns the paths it removed. Throws when the starter template is missing,
 * because an app with no `index.stx` falls back to the framework default,
 * which is the same desktop demo this is removing.
 */
export function applyAppSiteTemplate(root: string): string[] {
  const template = join(root, APP_SITE_TEMPLATE)
  if (!existsSync(template))
    throw new Error(`No app site template at ${APP_SITE_TEMPLATE}`)

  const removed: string[] = []
  for (const relative of SITE_ONLY_PATHS) {
    const target = join(root, relative)
    if (!existsSync(target))
      continue

    rmSync(target, { recursive: true, force: true })
    removed.push(relative)
  }

  for (const relative of removed) {
    // Walk up while the parent is empty: `public/assets/styles` empties, then
    // `public/assets`, and `content/` once its blog has gone. `resources/` and
    // `public/` themselves always stay.
    let dir = parentOf(relative)
    while (dir && !KEPT_ROOTS.has(dir) && isEmptyDir(join(root, dir))) {
      rmSync(join(root, dir), { recursive: true, force: true })
      dir = parentOf(dir)
    }
  }

  cpSync(template, join(root, 'resources'), { recursive: true })

  return removed
}

const KEPT_ROOTS = new Set(['resources', 'public'])

function parentOf(relative: string): string {
  return relative.includes('/') ? relative.slice(0, relative.lastIndexOf('/')) : ''
}

function isEmptyDir(dir: string): boolean {
  return existsSync(dir) && readdirSync(dir).length === 0
}
