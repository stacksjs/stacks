import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Everything in the template that belongs to stacksjs.com rather than to an
 * app, relative to the project root.
 *
 * `buddy new` scaffolds by downloading this repository, and this repository IS
 * stacksjs.com: its `resources/` and `public/` hold the marketing site, its
 * brand fonts and park illustrations, and a desktop-OS demo. Left in place, a
 * new app deployed as-is publishes a canonical URL and an Organization graph
 * claiming to be stacksjs.com, and carries about 3MB of someone else's brand.
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
    // Walk up while the parent is empty, stopping below `resources/` and
    // `public/` themselves: `public/assets/styles` empties, then `public/assets`.
    let dir = parentOf(relative)
    while (dir.includes('/') && isEmptyDir(join(root, dir))) {
      rmSync(join(root, dir), { recursive: true, force: true })
      dir = parentOf(dir)
    }
  }

  cpSync(template, join(root, 'resources'), { recursive: true })

  return removed
}

function parentOf(relative: string): string {
  return relative.slice(0, relative.lastIndexOf('/'))
}

function isEmptyDir(dir: string): boolean {
  return existsSync(dir) && readdirSync(dir).length === 0
}
