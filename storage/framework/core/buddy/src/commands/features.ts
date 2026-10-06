import type { FeatureName } from '@stacksjs/features'
import type { CLI } from '@stacksjs/types'
import { existsSync, readdirSync, readFileSync, rmdirSync, statSync } from 'node:fs'
import { cp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { confirmOrNull, runCommand } from '@stacksjs/cli'
import { frameworkPath, projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { resultError, resultFailed } from '../result'

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

/*
 * The manifest moved to `@stacksjs/features`.
 *
 * The migration runner needs the table half of it to hide a disabled
 * feature's migrations, and it was reaching in here through a dynamic import
 * to get it - which made `@stacksjs/database` depend on the CLI. Re-exported
 * so everything that reads these from `@stacksjs/buddy` still can.
 */
export type { FeatureName } from '@stacksjs/features'
export {
  appModelClaimsTable,
  FEATURE_FILES,
  FEATURE_NAMES,
  FEATURE_TABLES,
  migrationFeature,
  migrationTable,
} from '@stacksjs/features'

// Imported as well as re-exported: `export … from` forwards the names without
// binding them here, and the commands below read the manifest directly.
import { FEATURE_FILES, FEATURE_NAMES, migrationFeature } from '@stacksjs/features'

/**
 * Returns the subset of a feature's manifest paths that currently exist
 * on disk under `root` (defaults to `projectPath()`). Used by both the
 * uninstall delete and the doctor orphan check.
 */
export function featurePathsPresent(feature: FeatureName, root: string = projectPath()): string[] {
  return FEATURE_FILES[feature].filter(rel => existsSync(`${root}/${rel}`))
}

/** Every file under `dir`, as paths relative to it. */
function filesUnder(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...filesUnder(join(dir, entry.name), rel))
    else out.push(rel)
  }
  return out
}

/** Whether the project's copy is byte-identical to the template it came from. */
function matchesTemplate(projectFile: string, templateFile: string): boolean {
  if (!existsSync(templateFile)) return false
  try {
    return readFileSync(projectFile).equals(readFileSync(templateFile))
  }
  catch {
    // Unreadable is not "unchanged". Keeping it is the safe direction.
    return false
  }
}

/** Drop directories that the deletion emptied, deepest first. */
function pruneEmptyDirs(root: string, dir: string): void {
  let current = dir
  while (current.startsWith(root) && current !== root) {
    try {
      if (readdirSync(current).length > 0) return
      rmdirSync(current)
    }
    catch {
      return
    }
    current = join(current, '..')
  }
}

export interface DeleteFeatureFilesOptions {
  /**
   * Delete a path even when it differs from the template it was stamped from.
   * Default `false`, so an edited file survives `<feature>:uninstall`.
   */
  force?: boolean
  /** Source root holding the framework defaults. Override for tests. */
  source?: string
  /** Report what would be removed and kept, and remove nothing. */
  dryRun?: boolean
}

/**
 * Delete the paths in a feature's manifest that are still as this command left
 * them, and keep the ones that are not (stacksjs/stacks#2598).
 *
 * This used to `rm -rf` every claimed path unconditionally, which made the two
 * halves of the same file disagree: `copyFeatureFiles` below refuses to
 * overwrite a path that already exists, "don't overwrite the user's
 * possibly-customised file", and this removed that same customised file
 * without looking. The framework protected your edits on the way in and
 * deleted them on the way out.
 *
 * The rule it follows now is the one `stack:uninstall` already used - a
 * command may remove what it put there and left untouched, and anything the
 * developer changed needs `--force`. `uninstallStack` compares a checksum
 * recorded at install time; features keep no such record, so the comparison is
 * against the template in `storage/framework/defaults/<path>` instead. That is
 * weaker in one way worth knowing: a file edited and then edited back to match
 * the template reads as untouched.
 *
 * Directory entries - which most feature paths are - are compared per file, so
 * one edited action does not strand the other twenty beside it.
 *
 * Missing entries are skipped silently, so the operation stays safe to re-run.
 */
export async function deleteFeatureFiles(
  feature: FeatureName,
  root: string = projectPath(),
  options: DeleteFeatureFilesOptions = {},
): Promise<{ removed: string[], preserved: string[] }> {
  const source = options.source ?? frameworkPath('defaults')
  const force = options.force === true
  const dryRun = options.dryRun === true
  const remove = async (path: string, recursive = false): Promise<void> => {
    if (!dryRun)
      await rm(path, { recursive, force: true })
  }

  const removed: string[] = []
  const preserved: string[] = []

  for (const rel of FEATURE_FILES[feature]) {
    const full = join(root, rel)
    if (!existsSync(full)) continue

    if (force) {
      await remove(full, true)
      removed.push(rel)
      continue
    }

    const template = join(source, rel)

    if (!statSync(full).isDirectory()) {
      if (matchesTemplate(full, template)) {
        await remove(full)
        removed.push(rel)
      }
      else {
        preserved.push(rel)
      }
      continue
    }

    // A directory: take it apart file by file so one edit does not pin the
    // whole tree, and one untouched file does not drag an edited sibling out.
    let keptAny = false
    for (const child of filesUnder(full)) {
      const projectFile = join(full, child)
      if (matchesTemplate(projectFile, join(template, child))) {
        await remove(projectFile)
        removed.push(`${rel}${child}`)
      }
      else {
        keptAny = true
        preserved.push(`${rel}${child}`)
      }
    }

    if (dryRun)
      continue
    pruneEmptyDirs(root, full)
    if (!keptAny && existsSync(full))
      await rm(full, { recursive: true, force: true })
  }

  return { removed, preserved }
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
  /** Report what would be copied, and copy nothing. */
  dryRun?: boolean
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
    if (options.dryRun !== true)
      await cp(sourceFull, targetFull, { recursive: true, force })
    copied.push(rel)
  }

  return { copied, skipped }
}

const FEATURE_DESCRIPTIONS: Record<FeatureName, string> = {
  dashboard: 'Admin SPA shell + Activity/Log/Request/Deployment/Notification dashboards.',
  commerce: 'Order/Cart/Product/Customer/Coupon/GiftCard/Shipping + storefront API.',
  cms: 'Post/Page/Author/Comment/Tag models + content edit dashboards.',
  forms: 'User-defined forms: builder models, conditional fields, public submit + CSV export.',
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

  forms: `import type { FormsConfig } from '@stacksjs/types'

/**
 * **Forms Configuration**
 *
 * Controls the form-builder bundle (Form / FormField / FormSubmission
 * models, public submit endpoints, CSV export).
 */
export default {
  enabled: true,
} satisfies FormsConfig
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
/** Where the feature's own `enabled` flag sits, and what it says. */
interface TopLevelEnabled {
  index: number
  length: number
  value: boolean
}

/** Blank out comments so a flag mentioned in prose is never matched as code. */
function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
    .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length))
}

/**
 * Locate the feature's own `enabled: <bool>`, at depth 1 of `export default {`.
 *
 * A regex cannot do this. `config/dashboard.ts` carries per-section flags
 * (`library: { enabled: true }`) beside its own, and the previous pattern
 * anchored on newline-or-`{`, so it matched whichever came first in the file.
 * Today the top-level flag happens to be written above the sections, so it
 * worked by position; reorder that file, or ship a feature config whose
 * sections come first, and `<feature>:install` would have flipped a section's
 * flag and left the feature off, silently.
 *
 * Scans brace depth instead, over a comment-stripped copy so the commentary in
 * `config/dashboard.ts` - which names `commerce.enabled: false` in prose - is
 * not a candidate. Indexes refer to the original string, so the caller can
 * splice into it directly.
 */
function findTopLevelEnabled(src: string): TopLevelEnabled | null {
  const scan = withoutComments(src)
  const start = scan.search(/export default\s*\{/)
  if (start === -1) return null

  const open = scan.indexOf('{', start)
  let depth = 0

  for (let i = open; i < scan.length; i++) {
    const char = scan[i]
    if (char === '{') {
      depth++
      continue
    }
    if (char === '}') {
      depth--
      if (depth === 0) return null
      continue
    }
    if (depth !== 1 || char !== 'e') continue

    const match = /^enabled\s*:\s*(true|false)/.exec(scan.slice(i))
    if (!match) continue
    // Only a property name, never the tail of another identifier.
    if (i > 0 && /[\w$]/.test(scan[i - 1]!)) continue

    return { index: i, length: match[0].length, value: match[1] === 'true' }
  }

  return null
}

/**
 * What `config/<feature>.ts` declares, without resolving config.
 *
 * `'absent'` when the file is missing, `'unset'` when it exists with no
 * top-level flag. Reports the declaration only: `feature()` is the authority on
 * whether the feature is actually on, because it also applies the optional
 * `env: [...]` narrowing and any runtime override.
 */
export function readFeatureFlag(feature: FeatureName, root: string = projectPath()): true | false | 'absent' | 'unset' {
  const path = join(root, `config/${feature}.ts`)
  if (!existsSync(path)) return 'absent'

  const found = findTopLevelEnabled(readFileSync(path, 'utf8'))
  if (!found) return 'unset'
  return found.value
}

/**
 * Migrations the feature owns, split by whether the runner has hidden them.
 *
 * The runner renames a disabled feature's files to `<name>.sql.disabled` at
 * migrate time rather than deleting them, so both spellings are counted and
 * reported separately. Scans the dialect subdirectories too, since Postgres
 * gets its own corpus under `database/migrations/postgres`.
 */
export function featureMigrationCounts(feature: FeatureName, root: string = projectPath()): { active: number, hidden: number } {
  const counts = { active: 0, hidden: 0 }
  const base = join(root, 'database/migrations')
  if (!existsSync(base)) return counts

  const dirs = [base]
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (entry.isDirectory())
      dirs.push(join(base, entry.name))
  }

  for (const dir of dirs) {
    for (const file of readdirSync(dir)) {
      const hidden = file.endsWith('.sql.disabled')
      if (!hidden && !file.endsWith('.sql')) continue
      const sqlName = hidden ? file.slice(0, -'.disabled'.length) : file
      if (migrationFeature(sqlName) !== feature) continue
      if (hidden) counts.hidden++
      else counts.active++
    }
  }

  return counts
}

export async function setFeatureEnabled(
  feature: FeatureName,
  enabled: boolean,
  options: { createIfMissing: boolean, root?: string, dryRun?: boolean },
): Promise<SetFeatureEnabledOutcome> {
  // With `dryRun` the outcome is worked out exactly as below and nothing is
  // written: `write` is the only thing that touches the disk.
  const write = async (target: string, contents: string): Promise<void> => {
    if (options.dryRun !== true)
      await Bun.write(target, contents)
  }
  const path = options.root
    ? join(options.root, `config/${feature}.ts`)
    : projectPath(`config/${feature}.ts`)
  const file = Bun.file(path)

  if (!(await file.exists())) {
    if (!options.createIfMissing) return 'missing'
    await write(path, STARTER_TEMPLATES[feature])
    return 'created'
  }

  const src = await file.text()

  const found = findTopLevelEnabled(src)

  if (found) {
    if (found.value === enabled) return 'unchanged'
    const replaced = src.slice(0, found.index) + `enabled: ${enabled}` + src.slice(found.index + found.length)
    await write(path, replaced)
    return 'flipped'
  }

  // File exists but has no `enabled` field yet — insert one right after
  // the opening `{` of the default export. Anchored on
  // `export default {` so we don't trip on unrelated braces (typed
  // satisfies clauses, nested objects).
  const insertRegex = /(export default\s*\{)/
  if (!insertRegex.test(src)) {
    throw new Error(
      `Could not locate \`export default {\` in ${path} - please add \`enabled: ${enabled}\` manually.`,
    )
  }
  const next = src.replace(insertRegex, `$1\n  enabled: ${enabled},`)
  await write(path, next)
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
    // `force`, unlike the per-feature command. This backs `./buddy new
    // --minimal`, where the scaffolding was stamped seconds ago and there are
    // no edits to protect - and where `buddy new` stamps through gitit, whose
    // substitutions would make a freshly written file read as modified and
    // leave `--minimal` anything but.
    const { removed: filesRemoved } = await deleteFeatureFiles(feature, root, { force: true })
    results.push({ feature, configOutcome, filesRemoved })
  }
  return results
}

/**
 * Whether this run is a preview. `--dry-run` is registered process-wide (see
 * global-options.ts), so it shows in every command's help; install and
 * uninstall used to ignore it, and `commerce:install --dry-run` wrote the
 * config flag and stamped the whole commerce bundle into the project - which
 * a running dev server then turned into migrations. Read from argv as well as
 * the parsed options, as `buddy setup` does, so it holds however the flag
 * arrives.
 */
function isDryRun(options: { dryRun?: boolean }): boolean {
  return options.dryRun === true || process.argv.includes('--dry-run')
}

/**
 * Offer to run the migrations the feature just activated.
 *
 * Installing flips the flag and stamps the files; it does not create tables.
 * Until `./buddy migrate` runs, the models load and every query fails on a
 * missing table, which reads like a broken install rather than a pending step.
 *
 * `confirmOrNull` rather than `confirm`, deliberately: running migrations
 * writes to a database, and `confirm` maps end-of-input to its default, so a
 * piped or CI invocation would answer yes on the user's behalf. `null` means
 * nobody answered - print the command and let them run it.
 */
async function offerMigrate(feature: FeatureName): Promise<void> {
  const { active, hidden } = featureMigrationCounts(feature)
  const total = active + hidden
  if (total === 0)
    return

  const plural = total === 1 ? 'migration' : 'migrations'
  console.log(`  → ${feature} owns ${total} ${plural}; its tables do not exist until they run.`)

  const answer = await confirmOrNull({ message: `Run ./buddy migrate now?`, initial: false })
  if (answer !== true) {
    console.log(answer === null
      ? `  → Not asking (non-interactive). Run ./buddy migrate when ready.`
      : `  → Skipped. Run ./buddy migrate when ready.`)
    return
  }

  const result = await runCommand('./buddy migrate', { cwd: projectPath() })
  if (resultFailed(result)) {
    // Not fatal to the install: the flag and the files are already in place,
    // and the failure is usually a database that is not reachable yet.
    // `resultError` rather than the raw error, so migrate's own message - the
    // dialect mismatch, the column it would drop - is what gets printed.
    console.error(`✗ ./buddy migrate failed: ${resultError(result)}`)
    console.error(`  → ${feature} is installed; re-run ./buddy migrate once that is resolved.`)
    return
  }

  console.log(`✓ Migrated.`)
}

function registerInstallPair(buddy: CLI, feature: FeatureName): void {
  const desc = FEATURE_DESCRIPTIONS[feature]
  const configRel = `config/${feature}.ts`

  buddy
    .command(`${feature}:install`, `Activate the ${feature} feature bundle. ${desc}`)
    .option('--force', `Overwrite any existing ${feature} files in the project (default skips existing paths so the install is idempotent).`)
    .option('--dry-run', `Say what ${feature}:install would change, and change nothing.`, { default: false })
    .action(async (options: { force?: boolean, dryRun?: boolean }) => {
      try {
        const dryRun = isDryRun(options)
        const mark = dryRun ? '·' : '✓'
        const outcome = await setFeatureEnabled(feature, true, { createIfMissing: true, dryRun })
        switch (outcome) {
          case 'created':
            console.log(dryRun ? `${mark} Would create ${configRel} with '${feature}' enabled.` : `${mark} Created ${configRel} with '${feature}' enabled.`)
            break
          case 'flipped':
            console.log(dryRun ? `${mark} Would enable '${feature}' in ${configRel}.` : `${mark} Enabled '${feature}' in ${configRel}.`)
            break
          case 'unchanged':
            console.log(`${mark} '${feature}' is already enabled in ${configRel}.`)
            break
        }

        const { copied } = await copyFeatureFiles(feature, { force: options.force === true, dryRun })
        if (copied.length > 0) {
          console.log(dryRun
            ? `${mark} Would copy ${copied.length} stamped path(s) from framework defaults:`
            : `${mark} Copied ${copied.length} stamped path(s) from framework defaults:`)
          for (const path of copied) console.log(`    - ${path}`)
        }
        else if (featurePathsPresent(feature).length > 0) {
          console.log(`  → ${feature} scaffolding already in place - use --force to overwrite.`)
        }

        if (dryRun) {
          console.log(`  → Dry run: nothing was written. Run it without --dry-run to install ${feature}.`)
          process.exit(ExitCode.Success)
        }

        await offerMigrate(feature)

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
    .option('--force', `Delete the ${feature} scaffolding even where you have edited it. Without this, changed files are kept.`)
    .option('--dry-run', `Say what ${feature}:uninstall would change, and change nothing.`, { default: false })
    .action(async (options: { keepFiles?: boolean, force?: boolean, dryRun?: boolean }) => {
      try {
        const dryRun = isDryRun(options)
        const mark = dryRun ? '·' : '✓'
        const outcome = await setFeatureEnabled(feature, false, { createIfMissing: false, dryRun })
        switch (outcome) {
          case 'missing':
            console.log(`${mark} '${feature}' is already disabled (${configRel} is absent).`)
            break
          case 'flipped':
            console.log(dryRun ? `${mark} Would disable '${feature}' in ${configRel}.` : `${mark} Disabled '${feature}' in ${configRel}. Custom config preserved.`)
            break
          case 'unchanged':
            console.log(`${mark} '${feature}' is already disabled in ${configRel}.`)
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
          const { removed, preserved } = await deleteFeatureFiles(feature, projectPath(), { force: options.force, dryRun })
          if (removed.length > 0) {
            console.log(dryRun ? `${mark} Would remove ${removed.length} stamped path(s):` : `${mark} Removed ${removed.length} stamped path(s):`)
            for (const path of removed) console.log(`    - ${path}`)
          }
          if (preserved.length > 0) {
            // Named rather than counted: the whole point is that the developer
            // can see which of their edits survived, and decide.
            console.log(dryRun
              ? `  → Would keep ${preserved.length} path(s) you have edited (--force would remove them):`
              : `  → Kept ${preserved.length} path(s) you have edited (re-run with --force to remove):`)
            for (const path of preserved) console.log(`    - ${path}`)
          }
        }

        console.log(dryRun
          ? `  → Dry run: nothing was written or removed. Run it without --dry-run to uninstall ${feature}.`
          : `  → next ./buddy dev will boot without ${feature}.`)
        process.exit(ExitCode.Success)
      }
      catch (err) {
        console.error(`✗ Failed to uninstall ${feature}:`, err)
        process.exit(ExitCode.FatalError)
      }
    })
}

/**
 * `./buddy features` - what is on, and why.
 *
 * Named `features` rather than `<feature>:status` because `queue:status`
 * already exists and reports worker health; a second meaning for the same verb
 * on one feature and not the others would be worse than one overview.
 *
 * The two columns exist because they disagree in ways that are hard to see
 * otherwise. `declares` is the literal top-level flag in `config/<feature>.ts`;
 * `feature()` is what the running app gets, which also applies the optional
 * `env: [...]` narrowing and any runtime override. A feature declared `true`
 * that reads off here is almost always an env gate, and that is the single
 * most confusing state this subsystem has.
 */
function registerStatus(buddy: CLI): void {
  buddy
    .command('features', 'Show which framework feature bundles are active.')
    .action(async () => {
      try {
        const { feature, overridesReady } = await import('@stacksjs/config')
        // Without this the flags read as framework defaults rather than the
        // app's config, because overrides land asynchronously.
        await overridesReady

        const rows = FEATURE_NAMES.map((name) => {
          const declared = readFeatureFlag(name)
          const active = feature(name)
          const migrations = featureMigrationCounts(name)
          return { name, declared, active, migrations, scaffolded: featurePathsPresent(name).length }
        })

        const enabled = rows.filter(r => r.active).length
        console.log('')
        console.log(`Feature bundles  (${enabled} of ${rows.length} active)`)
        console.log('')

        for (const row of rows) {
          const mark = row.active ? '✓' : '·'
          const declared = row.declared === 'absent'
            ? 'no config'
            : row.declared === 'unset'
              ? 'flag unset'
              : `enabled: ${row.declared}`

          const parts = [`${mark} ${row.name.padEnd(11)}`, declared.padEnd(14)]

          const total = row.migrations.active + row.migrations.hidden
          const plural = total === 1 ? 'migration' : 'migrations'
          if (total > 0) {
            parts.push(row.migrations.hidden > 0
              ? `${total} ${plural} (${row.migrations.hidden} hidden)`
              : `${total} ${plural}`)
          }
          else {
            parts.push('')
          }

          console.log(`  ${parts.join('  ')}`)

          // Only the states a reader would otherwise have to work out.
          if (row.declared === true && !row.active)
            console.log(`      declared on but reading off - check \`env\` in config/${row.name}.ts against config.app.env`)
          if (row.declared === false && row.active)
            console.log(`      declared off but reading on - a runtime override is in play`)
          if (!row.active && row.scaffolded > 0)
            console.log(`      ${row.scaffolded} scaffolded path(s) still present - \`./buddy ${row.name}:uninstall\` removes them`)
          if (row.active && row.migrations.hidden > 0)
            console.log(`      ${row.migrations.hidden} migration(s) still hidden from a previous run - \`./buddy migrate\` restores them`)
        }

        console.log('')
        console.log('  ./buddy <feature>:install activates one, <feature>:uninstall turns it off.')
        console.log('')
        process.exit(ExitCode.Success)
      }
      catch (err) {
        console.error('✗ Failed to read feature status:', err)
        process.exit(ExitCode.FatalError)
      }
    })
}

export function features(buddy: CLI): void {
  registerStatus(buddy)
  for (const feature of FEATURE_NAMES)
    registerInstallPair(buddy, feature)
}
