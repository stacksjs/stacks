/**
 * Which files and tables belong to which optional feature.
 *
 * Two very different callers need this and neither should own it. The CLI
 * installs and uninstalls a feature, so it needs the file manifest. The
 * migration runner hides the migrations of a disabled feature before a run,
 * so it needs the table manifest - and it was reaching into `@stacksjs/buddy`
 * through a best-effort dynamic import to get it, which made the database
 * package depend on the CLI and put both inside the framework's dependency
 * cycle.
 *
 * Nothing here reads config or touches a database. It is the manifest and
 * three lookups over it.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectPath } from '@stacksjs/path'

export const FEATURE_NAMES = [
  'dashboard',
  'commerce',
  'cms',
  'forms',
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
 * A feature must also claim the shared files its own actions IMPORT.
 * `app/Actions/Dashboard/dashboard-response.ts` is the case that bit: five
 * features publish a subdirectory of `app/Actions/Dashboard/`, and the actions
 * in each import `../dashboard-response`. Without it, `<feature>:install`
 * copied 22 actions whose very first import did not resolve.
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
  forms: [
    'app/Models/Forms/',
  ],
  cms: [
    'app/Actions/Cms/',
    'app/Actions/Dashboard/Content/',
    'app/Actions/Dashboard/dashboard-response.ts',
    'app/Models/Content/',
    'app/Models/Tag.ts',
    'app/Models/Comment.ts',
    'resources/views/dashboard/content/',
  ],
  commerce: [
    'app/Actions/Commerce/',
    'app/Actions/Dashboard/Commerce/',
    'app/Actions/Dashboard/dashboard-response.ts',
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
    'app/Actions/Dashboard/dashboard-response.ts',
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
    'app/Actions/Dashboard/dashboard-response.ts',
    'app/Models/realtime/',
    'app/Broadcasts/',
    'functions/realtime/',
    'resources/views/dashboard/realtime/',
  ],
  queue: [
    'app/Actions/Queue/',
    'app/Actions/Dashboard/Jobs/',
    'app/Actions/Dashboard/dashboard-response.ts',
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
  forms: ['forms', 'form_fields', 'form_submissions'],
  // The polymorphic pivots belong here too: they carry foreign keys to
  // `posts`/`tags`/`categories`, so leaving them unclaimed means they run
  // against a database where the tables they point at were gated out.
  cms: [
    'posts', 'pages', 'comments', 'tags', 'authors', 'categories',
    'taggable_models', 'categorizable_models', 'commentables',
    // Real-pages additions: revisions snapshot pages, redirects + menus key
    // to sites/pages, so they gate out together with the rest of the CMS.
    'page_revisions', 'redirects', 'menus', 'menu_items',
  ],
  commerce: [
    'products', 'product_variants', 'product_units', 'manufacturers',
    'orders', 'order_items', 'order_idempotency', 'carts', 'cart_items',
    'payments', 'payment_methods', 'payment_products', 'payment_transactions',
    'customers', 'subscribers', 'subscriber_emails', 'subscriptions',
    'gift_cards', 'coupons', 'transactions', 'reviews',
    // `delivery_stops` keys to `delivery_routes` and `courier_pings` to
    // `couriers`, so both have to be hidden alongside them. Unclaimed, their
    // migrations ran with commerce disabled — the default — against a database
    // where those parents were deliberately left out, and the run died on the
    // foreign key.
    'couriers', 'courier_pings', 'delivery_routes', 'delivery_stops', 'digital_deliveries',
    'shipping_methods', 'shipping_rates', 'shipping_zones',
    'license_keys', 'loyalty_points', 'loyalty_rewards',
    'print_devices', 'receipts', 'tax_rates',
    'waitlist_products', 'waitlist_restaurants',
    // Benefit auctions. `bids` and `pledges` key to `auctions`, so all four
    // gate together or a disabled bundle's migrations run against missing
    // parents.
    'auctions', 'auction_items', 'bids', 'pledges',
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
  // These do generate tables, and two of them reference `subscribers`,
  // which commerce owns and gates.
  marketing: [
    'campaigns', 'campaign_sends', 'email_lists', 'email_list_subscribers',
    'social_posts', 'mail_preferences',
  ],
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
  if (inMatch) return inMatch[1] ?? null
  const createMatch = filename.match(/-create-([a-z0-9_]+)-table\.sql$/i)
  if (createMatch) return createMatch[1] ?? null
  const alterMatch = filename.match(/-alter-([a-z0-9_]+)-/i)
  if (alterMatch) return alterMatch[1] ?? null
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
 * True when an application-owned, top-level model explicitly declares a table.
 * This lets apps intentionally use generic names such as `payments` without
 * their migrations being mistaken for disabled framework-feature scaffolding.
 * Root models listed in FEATURE_FILES remain feature-owned and do not override
 * the gate.
 */
export function appModelClaimsTable(table: string, root: string = projectPath()): boolean {
  const modelsDir = join(root, 'app/Models')
  if (!existsSync(modelsDir)) return false
  const featureModelFiles = new Set(
    FEATURE_NAMES.flatMap(feature => FEATURE_FILES[feature])
      .filter(path => path.startsWith('app/Models/') && !path.endsWith('/')),
  )
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const declaration = new RegExp(`\\btable\\s*:\\s*['"]${escaped}['"]`)
  for (const entry of readdirSync(modelsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.[cm]?[jt]s$/.test(entry.name)) continue
    if (featureModelFiles.has(`app/Models/${entry.name}`)) continue
    if (declaration.test(readFileSync(join(modelsDir, entry.name), 'utf8'))) return true
  }
  return false
}