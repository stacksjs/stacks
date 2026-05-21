import type { CLI } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { cp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { frameworkPath, projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

/**
 * Feature install / uninstall commands.
 *
 * Each framework feature bundle (dashboard, commerce, cms, marketing,
 * monitoring, realtime, queue) lives in its own `config/<feature>.ts`
 * file. Running `./buddy <feature>:install` flips that file's top-level
 * `enabled` to `true` (scaffolding the file from a starter template if it's
 * missing). `./buddy <feature>:uninstall` flips the flag back to `false`
 * AND removes the feature's stamped action/model/view files from the
 * project (pass `--keep-files` to preserve them); the config file itself
 * is preserved so any custom driver/credential settings survive a future
 * reinstall.
 *
 * The framework loaders (`orm/index.ts` eager-load, `defaults/bootstrap.ts`
 * route registration, action prefetch) consult `feature(name)` at boot and
 * skip anything whose flag is off — so an app with only `auth` activated
 * never pays the cost of importing 70+ Commerce models or registering
 * hundreds of dashboard routes it doesn't use.
 *
 * Auth is intentionally not in this list: it has its own scaffolding
 * pipeline (`buddy auth:setup`) which handles migrations + personal-access
 * client setup beyond a simple `enabled` flip.
 *
 * Mirrors Laravel's `php artisan passport:install` / `horizon:install`
 * pattern: features are inert dead code on disk until installed.
 */

export const FEATURE_NAMES = [
  'dashboard',
  'commerce',
  'cms',
  'marketing',
  'monitoring',
  'realtime',
  'queue',
] as const

export type FeatureName = (typeof FEATURE_NAMES)[number]

/**
 * Per-feature stamped file/directory manifest. Paths are relative to the
 * project root and mirror the layout that `./buddy new` lays down. Entries
 * ending in `/` are directory trees (recursive remove on uninstall); bare
 * paths are single files.
 *
 * Manifests intentionally overlap where features share scaffolding —
 * `dashboard` claims the umbrella `app/Actions/Dashboard/` even though
 * `app/Actions/Dashboard/Content/` is also claimed by `cms`. Both the
 * uninstall delete and the doctor orphan check are idempotent
 * (already-gone paths are skipped silently), so the overlap is safe.
 *
 * Adding a new file to one of these directories does **not** require a
 * manifest update — directory entries are recursive. Only add an entry
 * when a feature introduces a new top-level path the framework didn't
 * already claim.
 */
export const FEATURE_FILES: Record<FeatureName, readonly string[]> = {
  cms: [
    'app/Actions/Cms/',
    'app/Actions/Dashboard/Content/',
    'app/Models/Content/',
    'app/Models/Tag.ts',
    'app/Models/Comment.ts',
    'resources/views/dashboard/content/',
  ],
  commerce: [
    'app/Actions/Commerce/',
    'app/Actions/Dashboard/Commerce/',
    'app/Models/commerce/',
    'resources/components/Dashboard/Commerce/',
    'resources/views/dashboard/commerce/',
  ],
  dashboard: [
    'app/Actions/Dashboard/',
    'resources/components/Dashboard/',
    'resources/views/dashboard/',
    'routes/dashboard.ts',
    'routes/dashboard-api.ts',
  ],
  marketing: [
    'app/Actions/Dashboard/Marketing/',
    'app/Models/Campaign.ts',
    'app/Models/CampaignSend.ts',
    'app/Models/EmailList.ts',
    'app/Models/EmailListSubscriber.ts',
    'app/Models/SocialPost.ts',
    'resources/components/Marketing/',
    'resources/views/dashboard/marketing/',
  ],
  monitoring: [
    'app/Actions/Monitoring/',
    'app/Actions/TestErrorAction.ts',
    'app/Models/Error.ts',
    'functions/monitoring/',
    'resources/views/dashboard/monitoring/',
    'resources/views/dashboard/errors/',
  ],
  realtime: [
    'app/Actions/Realtime/',
    'app/Actions/Dashboard/Realtime/',
    'app/Models/realtime/',
    'app/Broadcasts/',
    'functions/realtime/',
    'resources/views/dashboard/realtime/',
  ],
  queue: [
    'app/Actions/Queue/',
    'app/Actions/Dashboard/Jobs/',
    'app/Jobs/',
    'app/Models/Job.ts',
    'app/Models/FailedJob.ts',
    'functions/jobs.ts',
    'resources/views/dashboard/queue/',
    'resources/views/dashboard/jobs/',
  ],
}

/**
 * Per-feature database table ownership (stacksjs/stacks#1854).
 *
 * Stacks generates SQL migrations from model files, so each feature's
 * tables map 1:1 with the models in its `FEATURE_FILES.app/Models/...`
 * entries. Listed here explicitly rather than derived at runtime so
 * additions are visible in a single grep-able place and the migration
 * gate doesn't depend on filesystem scanning at boot.
 *
 * The migration runner consults this when `config.<feature>.enabled =
 * false`: matching `*-create-<table>-table.sql` (and `*-alter-<table>-*.sql`)
 * files get hidden for the duration of the run, so a project that
 * never installed CMS doesn't materialize `posts`, `pages`,
 * `comments`, etc. on `./buddy migrate`.
 *
 * Tables on this list are scoped to a single feature. Tables shared
 * across features (none today, but `categories` could end up here)
 * should stay out of the manifest until that's resolved — the runner
 * defaults to "run unless owned by a disabled feature".
 */
export const FEATURE_TABLES: Record<FeatureName, readonly string[]> = {
  cms: ['posts', 'pages', 'comments', 'tags', 'authors', 'categories'],
  commerce: [
    'products', 'product_variants', 'product_units', 'manufacturers',
    'orders', 'order_items', 'carts', 'cart_items',
    'payments', 'payment_methods', 'payment_products', 'payment_transactions',
    'customers', 'subscribers', 'subscriber_emails', 'subscriptions',
    'gift_cards', 'coupons', 'transactions', 'reviews',
    'drivers', 'delivery_routes', 'digital_deliveries',
    'shipping_methods', 'shipping_rates', 'shipping_zones',
    'license_keys', 'loyalty_points', 'loyalty_rewards',
    'print_devices', 'receipts', 'tax_rates',
    'waitlist_products', 'waitlist_restaurants',
  ],
  dashboard: [
    // Kanban
    'boards', 'board_columns', 'cards', 'card_labels', 'card_assignees',
    'card_comments', 'labels',
    // CI tracking surface
    'ci_run_states', 'ci_runner_samples', 'ci_runner_alert_states',
    // Dashboard observability tables
    'requests', 'logs',
  ],
  marketing: [], // Marketing models exist but don't generate dedicated tables yet
  monitoring: ['errors'],
  realtime: ['websockets'],
  queue: ['jobs', 'failed_jobs'],
}

/**
 * Parse a migration filename like `0000000045-create-posts-table.sql` or
 * `0000000085-alter-posts-author_id.sql` to extract the table name it
 * acts on. Returns `null` for filenames that don't match the
 * recognised `create-<table>-table` / `alter-<table>-` shapes — those
 * pass through the gate unchanged.
 *
 * Index migrations (`create-<table>_<col>_unique-index-in-<table>.sql`)
 * use the trailing `-in-<table>.sql` segment as the source of truth
 * since the leading segment includes the index name. The other
 * forms read the table from the segment immediately after the verb.
 */
export function migrationTable(filename: string): string | null {
  const inMatch = filename.match(/-in-([a-z0-9_]+)\.sql$/i)
  if (inMatch) return inMatch[1]
  const createMatch = filename.match(/-create-([a-z0-9_]+)-table\.sql$/i)
  if (createMatch) return createMatch[1]
  const alterMatch = filename.match(/-alter-([a-z0-9_]+)-/i)
  if (alterMatch) return alterMatch[1]
  return null
}

/**
 * Returns the feature that owns the given migration filename, or `null`
 * if the migration isn't claimed by any feature (in which case it
 * always runs). Used by the migration runner's gating pass.
 */
export function migrationFeature(filename: string): FeatureName | null {
  const table = migrationTable(filename)
  if (!table) return null
  for (const f of FEATURE_NAMES) {
    if (FEATURE_TABLES[f].includes(table)) return f
  }
  return null
}

/**
 * Returns the subset of a feature's manifest paths that currently exist
 * on disk under `root` (defaults to `projectPath()`). Used by both the
 * uninstall delete and the doctor orphan check.
 */
export function featurePathsPresent(feature: FeatureName, root: string = projectPath()): string[] {
  return FEATURE_FILES[feature].filter(rel => existsSync(`${root}/${rel}`))
}

/**
 * Recursively delete every file/dir listed in the feature's manifest under
 * `root` (defaults to `projectPath()`). Missing entries are skipped
 * silently — the operation is safe to re-run. Returns the list of paths
 * actually removed so the caller can print a useful summary.
 */
export async function deleteFeatureFiles(
  feature: FeatureName,
  root: string = projectPath(),
): Promise<string[]> {
  const removed: string[] = []
  for (const rel of FEATURE_FILES[feature]) {
    const full = `${root}/${rel}`
    if (!existsSync(full)) continue
    await rm(full, { recursive: true, force: true })
    removed.push(rel)
  }
  return removed
}

export interface CopyFeatureFilesOptions {
  /**
   * Overwrite target paths that already exist. Default `false`, so
   * re-running `<feature>:install` on a project that came out of
   * `./buddy new` (which stamps everything via gitit) is a clean no-op
   * for files that haven't been customised.
   */
  force?: boolean
  /**
   * Source root holding the framework defaults (`storage/framework/defaults/`).
   * Override for tests; production uses `frameworkPath('defaults')`.
   */
  source?: string
  /**
   * Target project root. Override for tests; production uses
   * `projectPath()`.
   */
  target?: string
}

/**
 * Copy every path listed in the feature's manifest from the framework
 * defaults tree (`storage/framework/defaults/<path>`) into the project
 * root (`<project>/<path>`). Missing source entries are skipped — not
 * every feature owns every manifest slot (e.g. `cms` doesn't ship a
 * `resources/components/Dashboard/Commerce/` dir, so that entry is
 * absent from its source). Existing target paths are also skipped by
 * default so re-running install on an existing project is idempotent.
 *
 * Returns the list of paths actually copied. See stacksjs/stacks#1854.
 */
export async function copyFeatureFiles(
  feature: FeatureName,
  options: CopyFeatureFilesOptions = {},
): Promise<{ copied: string[], skipped: string[] }> {
  const source = options.source ?? frameworkPath('defaults')
  const target = options.target ?? projectPath()
  const force = options.force === true

  const copied: string[] = []
  const skipped: string[] = []

  for (const rel of FEATURE_FILES[feature]) {
    const sourceFull = join(source, rel)
    if (!existsSync(sourceFull)) {
      // No template in defaults — nothing to stamp.
      skipped.push(rel)
      continue
    }
    const targetFull = join(target, rel)
    if (existsSync(targetFull) && !force) {
      // Already there; don't overwrite the user's possibly-customised file.
      skipped.push(rel)
      continue
    }
    await cp(sourceFull, targetFull, { recursive: true, force })
    copied.push(rel)
  }

  return { copied, skipped }
}

const FEATURE_DESCRIPTIONS: Record<FeatureName, string> = {
  dashboard: 'Admin SPA shell + Activity/Log/Request/Deployment/Notification dashboards.',
  commerce: 'Order/Cart/Product/Customer/Coupon/GiftCard/Shipping + storefront API.',
  cms: 'Post/Page/Author/Comment/Tag models + content edit dashboards.',
  marketing: '/api/email/subscribe, /api/contact, Campaign/EmailList/SocialPost.',
  monitoring: 'Error model + error-tracking views and actions.',
  realtime: 'WebSocket broadcaster + Websocket model + realtime-stats actions.',
  queue: 'Job + FailedJob models + queue dashboard pages.',
}

/**
 * Starter templates written when `config/<feature>.ts` is missing on install.
 * Each ships a top-level `enabled: true` plus the minimum config a user
 * would expect for that feature; they're intentionally light because
 * detailed defaults live in the framework's `defaults.ts`.
 */
const STARTER_TEMPLATES: Record<FeatureName, string> = {
  dashboard: `import type { DashboardConfig } from '@stacksjs/types'

/**
 * **Dashboard Configuration**
 *
 * Top-level feature gate plus per-section visibility toggles for the
 * \`buddy dev --dashboard\` sidebar. Userland models in \`app/Models/\`
 * always appear regardless of these flags.
 */
export default {
  enabled: true,

  sections: {
    library: { enabled: true },
    content: { enabled: true },
    commerce: { enabled: true },
    marketing: { enabled: true },
    analytics: { enabled: true },
    management: { enabled: true },
    utilities: { enabled: true },
    data: {
      dashboard: { enabled: true },
      activity: { enabled: true },
      users: { enabled: true },
      teams: { enabled: true },
      subscribers: { enabled: true },
      allModels: { enabled: true },
    },
  },
} satisfies DashboardConfig
`,

  commerce: `import type { CommerceConfig } from '@stacksjs/types'

/**
 * **Commerce Configuration**
 *
 * Controls the commerce feature bundle (Order, Cart, Product, Customer,
 * Coupon, GiftCard, Receipt, Shipping models + storefront API).
 */
export default {
  enabled: true,

  /** Default storefront currency (ISO 4217). */
  currency: 'USD',

  /** Default tax rate applied when a product/region rule doesn't override. */
  defaultTaxRate: 0,
} satisfies CommerceConfig
`,

  cms: `import type { CmsConfig } from '@stacksjs/types'

/**
 * **CMS Configuration**
 *
 * Controls the CMS feature bundle (Post, Page, Author, Comment, Tag,
 * Category models + content-edit dashboards).
 */
export default {
  enabled: true,
} satisfies CmsConfig
`,

  marketing: `import type { MarketingConfig } from '@stacksjs/types'

/**
 * **Marketing Configuration**
 *
 * Controls the marketing feature bundle (\`/api/email/subscribe\`,
 * \`/api/contact\`, Campaign / EmailList / SocialPost).
 */
export default {
  enabled: true,
} satisfies MarketingConfig
`,

  monitoring: `import type { MonitoringConfig } from '@stacksjs/types'

/**
 * **Monitoring Configuration**
 *
 * Controls the monitoring feature bundle (Error model + error-tracking
 * views and actions).
 */
export default {
  enabled: true,
} satisfies MonitoringConfig
`,

  realtime: `import type { RealtimeConfig } from '@stacksjs/types'

/**
 * **Realtime Configuration**
 *
 * Controls the realtime feature bundle (WebSocket broadcaster + Websocket
 * model + realtime-stats actions). The full set of options (driver, server,
 * channels, etc.) is documented at @stacksjs/realtime; this starter
 * template just flips the feature on.
 */
export default {
  enabled: true,
} satisfies RealtimeConfig
`,

  queue: `import type { QueueConfig } from '@stacksjs/types'

/**
 * **Queue Configuration**
 *
 * Controls the queue feature bundle (Job + FailedJob models + queue
 * dashboard pages). The full set of options (drivers, connections, worker
 * concurrency, etc.) is documented at @stacksjs/queue; this starter
 * template ships the \`sync\` driver so jobs execute immediately in dev.
 */
export default {
  enabled: true,

  default: 'sync',

  connections: {
    sync: { driver: 'sync' },
  },

  failed: {
    driver: 'database',
    table: 'failed_jobs',
  },
} satisfies QueueConfig
`,
}

export type SetFeatureEnabledOutcome = 'created' | 'flipped' | 'unchanged' | 'missing'

/**
 * Flip the top-level `enabled` field in `config/<feature>.ts` to the
 * desired value. Returns:
 *
 *   - 'created'   — file did not exist and we scaffolded it (install only)
 *   - 'flipped'   — file existed; `enabled` was on the opposite value
 *   - 'unchanged' — file existed; `enabled` already matched
 *   - 'missing'   — file did not exist and `createIfMissing` was false
 *                   (uninstall path: nothing to do, feature is already off)
 *
 * Pass `options.root` to target a project directory other than the
 * caller's working tree — `./buddy new --minimal` uses this to disable
 * features in the freshly-cloned project path before the user has cd'd
 * into it.
 */
export async function setFeatureEnabled(
  feature: FeatureName,
  enabled: boolean,
  options: { createIfMissing: boolean, root?: string },
): Promise<SetFeatureEnabledOutcome> {
  const path = options.root
    ? join(options.root, `config/${feature}.ts`)
    : projectPath(`config/${feature}.ts`)
  const file = Bun.file(path)

  if (!(await file.exists())) {
    if (!options.createIfMissing) return 'missing'
    await Bun.write(path, STARTER_TEMPLATES[feature])
    return 'created'
  }

  const src = await file.text()

  // Match a top-level `enabled: <bool>` declaration. The leading
  // newline-or-`{` anchor keeps us from accidentally rewriting a nested
  // `enabled` inside, e.g., dashboard sections.
  const enabledRegex = /(^|\{)(\s*)enabled\s*:\s*(true|false)(\s*,?)/m

  if (enabledRegex.test(src)) {
    const replaced = src.replace(enabledRegex, (_full, anchor, ws, current, trailing) => {
      if (current === String(enabled)) return `${anchor}${ws}enabled: ${current}${trailing}`
      return `${anchor}${ws}enabled: ${enabled}${trailing}`
    })
    if (replaced === src) return 'unchanged'
    await Bun.write(path, replaced)
    return 'flipped'
  }

  // File exists but has no `enabled` field yet — insert one right after
  // the opening `{` of the default export. Anchored on
  // `export default {` so we don't trip on unrelated braces (typed
  // satisfies clauses, nested objects).
  const insertRegex = /(export default\s*\{)/
  if (!insertRegex.test(src)) {
    throw new Error(
      `Could not locate \`export default {\` in ${path} — please add \`enabled: ${enabled}\` manually.`,
    )
  }
  const next = src.replace(insertRegex, `$1\n  enabled: ${enabled},`)
  await Bun.write(path, next)
  return 'flipped'
}

export interface UninstallAllFeaturesResult {
  feature: FeatureName
  configOutcome: SetFeatureEnabledOutcome
  filesRemoved: string[]
}

/**
 * Disable every feature in `FEATURE_NAMES` at once — flips
 * `config/<feature>.ts` enabled flags to `false` and removes the
 * stamped scaffolding under the project root.
 *
 * Used by `./buddy new --minimal` to turn the kitchen-sink template
 * `@stacksjs/gitit` clones into a bare-bones starter. Individual
 * `<feature>:install` commands re-enable + re-stamp on demand.
 *
 * Pass `root` to target a project directory other than `projectPath()`;
 * the create command uses this because `./buddy new` runs from the
 * user's cwd while the freshly-cloned project lives at `<cwd>/<name>`.
 *
 * Safe to re-run — both halves of each per-feature step are idempotent.
 */
export async function uninstallAllFeatures(
  options: { root?: string } = {},
): Promise<UninstallAllFeaturesResult[]> {
  const root = options.root ?? projectPath()
  const results: UninstallAllFeaturesResult[] = []
  for (const feature of FEATURE_NAMES) {
    const configOutcome = await setFeatureEnabled(feature, false, { createIfMissing: false, root })
    const filesRemoved = await deleteFeatureFiles(feature, root)
    results.push({ feature, configOutcome, filesRemoved })
  }
  return results
}

function registerInstallPair(buddy: CLI, feature: FeatureName): void {
  const desc = FEATURE_DESCRIPTIONS[feature]
  const configRel = `config/${feature}.ts`

  buddy
    .command(`${feature}:install`, `Activate the ${feature} feature bundle. ${desc}`)
    .option('--force', `Overwrite any existing ${feature} files in the project (default skips existing paths so the install is idempotent).`)
    .action(async (options: { force?: boolean }) => {
      try {
        const outcome = await setFeatureEnabled(feature, true, { createIfMissing: true })
        switch (outcome) {
          case 'created':
            console.log(`✓ Created ${configRel} with '${feature}' enabled.`)
            break
          case 'flipped':
            console.log(`✓ Enabled '${feature}' in ${configRel}.`)
            break
          case 'unchanged':
            console.log(`✓ '${feature}' is already enabled in ${configRel}.`)
            break
        }

        const { copied } = await copyFeatureFiles(feature, { force: options.force === true })
        if (copied.length > 0) {
          console.log(`✓ Copied ${copied.length} stamped path(s) from framework defaults:`)
          for (const path of copied) console.log(`    - ${path}`)
        }
        else if (featurePathsPresent(feature).length > 0) {
          console.log(`  → ${feature} scaffolding already in place — use --force to overwrite.`)
        }

        console.log(`  → next ./buddy dev will boot with ${feature} loaded.`)
        process.exit(ExitCode.Success)
      }
      catch (err) {
        console.error(`✗ Failed to install ${feature}:`, err)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command(`${feature}:uninstall`, `Deactivate the ${feature} feature bundle.`)
    .option('--keep-files', `Don't delete the ${feature} scaffolding (action/model/view files). Flip the flag only.`)
    .action(async (options: { keepFiles?: boolean }) => {
      try {
        const outcome = await setFeatureEnabled(feature, false, { createIfMissing: false })
        switch (outcome) {
          case 'missing':
            console.log(`✓ '${feature}' is already disabled (${configRel} is absent).`)
            break
          case 'flipped':
            console.log(`✓ Disabled '${feature}' in ${configRel}. Custom config preserved.`)
            break
          case 'unchanged':
            console.log(`✓ '${feature}' is already disabled in ${configRel}.`)
            break
          case 'created':
            // Defensive — setFeatureEnabled is called with createIfMissing:false,
            // so this branch is unreachable. Surface it loudly if it ever fires.
            console.log(`✗ Unexpected create on uninstall for ${feature}; please re-run with --force or report this bug.`)
            break
        }

        if (options.keepFiles) {
          const stillPresent = featurePathsPresent(feature)
          if (stillPresent.length > 0)
            console.log(`  → ${stillPresent.length} stamped path(s) preserved (--keep-files).`)
        }
        else {
          const removed = await deleteFeatureFiles(feature)
          if (removed.length > 0) {
            console.log(`✓ Removed ${removed.length} stamped path(s):`)
            for (const path of removed) console.log(`    - ${path}`)
          }
        }

        console.log(`  → next ./buddy dev will boot without ${feature}.`)
        process.exit(ExitCode.Success)
      }
      catch (err) {
        console.error(`✗ Failed to uninstall ${feature}:`, err)
        process.exit(ExitCode.FatalError)
      }
    })
}

export function features(buddy: CLI): void {
  for (const feature of FEATURE_NAMES)
    registerInstallPair(buddy, feature)
}
