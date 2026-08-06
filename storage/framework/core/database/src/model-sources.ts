/**
 * Resolve the model definitions the migration generator should read.
 *
 * Three problems this exists to solve.
 *
 * 1. The generator only ever looked at `app/Models`. A vendored framework
 *    checkout (and every freshly scaffolded project) has no such directory, so
 *    `generateMigrations()` returned `ok('Migrations generated')` having
 *    generated nothing, and the committed SQLite corpus was silently treated as
 *    the source of truth. Meanwhile the framework's own 62 models sit in
 *    `storage/framework/defaults/app/Models`, and every other consumer already
 *    knows to look there.
 *
 * 2. bun-query-builder's `loadModels` does `if (st.isDirectory()) continue`, so
 *    it reads only the TOP level of whatever directory it is handed. 33 of the
 *    62 default models are nested (`commerce/`, `cms/`, ...), including
 *    `commerce/PrintDevice.ts`. Pointing the generator straight at the defaults
 *    directory would therefore have emitted 29 of 62 tables and silently
 *    dropped print_devices, payments and orders, which is far worse than the
 *    failure it was meant to fix.
 *
 * 3. Fixing (1) by MERGING the two roots made every app inherit the framework's
 *    demo schema. Userland only overrode by name, so an app with five models
 *    migrated its five plus the framework's sixty-two — `carts`, `coupons`,
 *    `drivers`, `waitlist_restaurants` and the rest — and ended up with 88
 *    tables and a migrations table whose rows mostly had no file in the repo
 *    (stacksjs/stacks#2220). The intent in (1) was a FALLBACK for the root with
 *    no models of its own; a merge is not that. Defaults now apply only when
 *    userland contributes nothing, which is exactly the vendored-checkout and
 *    fresh-scaffold case they were added for.
 *
 * Models are collected recursively and staged into one flat directory that bqb
 * can read completely.
 */

import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'
import { config } from '@stacksjs/config'
import { path } from '@stacksjs/path'
import { plural, snakeCase } from '@stacksjs/strings'

export interface ModelSource {
  /** Absolute path to the model file. */
  file: string
  /** Basename without extension, used for collision resolution. */
  name: string
  /** Which root it came from. */
  origin: 'user' | 'framework'
}

/** A userland model that replaced a framework default of the same name. */
export interface ShadowedModel {
  name: string
  userFile: string
  frameworkFile: string
}

export interface ResolvedModelSources {
  /** A flat directory containing every model, safe to hand to bun-query-builder. */
  dir: string
  models: ModelSource[]
  /** Roots that actually contributed at least one model. */
  roots: string[]
  /** True when `dir` is a staging directory this call created. */
  staged: boolean
  /**
   * Which framework defaults a userland model replaced.
   *
   * Overriding is a supported thing to do, and it is also how somebody
   * accidentally writes a model that shares a framework table's name and
   * generates a migration dropping that table's columns - while the framework's
   * own code goes on reading them. Reported here so the migration generator can
   * recognise that case; see `shadowed-models.ts`.
   *
   * Only ever populated on the opt-in merge path below: with the defaults out
   * of scope entirely there is nothing left for a userland model to shadow.
   */
  shadowed: ShadowedModel[]
  /**
   * Framework defaults left OUT because userland has its own models.
   *
   * Empty in the two cases that matter most: an app that opted back into the
   * union, and a vendored checkout with no `app/Models` (where the defaults
   * ARE the model set). Callers use it to explain the narrowing, and the
   * migration generator uses {@link excludedTables} to keep the first run
   * after the narrowing from proposing a drop of every table that left scope.
   */
  excluded: ModelSource[]
  /** Table names owned by {@link excluded}, lowercased. */
  excludedTables: string[]
}

/** Collect model files recursively, skipping index barrels and dotfiles. */
function collectModels(root: string, origin: ModelSource['origin']): ModelSource[] {
  if (!existsSync(root))
    return []

  const out: ModelSource[] = []

  const walk = (dir: string) => {
    let entries: ReturnType<typeof readdirSync>
    try {
      entries = readdirSync(dir, { withFileTypes: true }) as any
    }
    catch {
      return
    }

    for (const entry of entries as any[]) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.name.endsWith('.ts'))
        continue
      if (entry.name.startsWith('.') || entry.name.startsWith('index'))
        continue

      out.push({ file: full, name: entry.name.replace(/\.ts$/, ''), origin })
    }
  }

  walk(root)
  return out
}

/**
 * Where the flattened copy lives. Under the framework runtime directory rather
 * than the OS temp dir so it is inspectable when a generation goes wrong, and
 * so it lands on the same filesystem as the source.
 */
export function modelStagingDir(): string {
  return path.frameworkRuntimePath('model-sources')
}

/**
 * Build the flat directory. Symlinks where the platform allows it (cheap, and
 * keeps the file identity obvious when debugging), falling back to a real copy
 * on platforms or filesystems that refuse symlinks.
 *
 * Model files import only from packages (verified across all 62 defaults), so a
 * copy cannot break relative specifiers.
 */
function stage(models: ModelSource[]): string {
  const dir = modelStagingDir()

  // Rebuild from scratch: a model deleted upstream must not survive here.
  try {
    rmSync(dir, { recursive: true, force: true })
  }
  catch { /* first run, or a stale handle; mkdir below still succeeds */ }

  mkdirSync(dir, { recursive: true })

  for (const model of models) {
    const target = join(dir, `${model.name}.ts`)
    try {
      symlinkSync(model.file, target)
    }
    catch {
      try {
        writeFileSync(target, readFileSync(model.file))
      }
      catch { /* skip an unreadable model rather than abort the whole run */ }
    }
  }

  return dir
}

/**
 * The table a model file declares, matching how the generator derives it:
 * an explicit `table:` wins, otherwise the pluralised snake_case model name.
 *
 * Read with a regex rather than by importing the model. This runs for every
 * excluded default on every generate, and importing 62 modules (each pulling
 * in `@stacksjs/orm` and `@stacksjs/validation`) to learn a string the file
 * states literally is not worth the boot. A model that computes its table name
 * at runtime is not matched, which costs only the drop suppression below —
 * the table still generates normally.
 */
export function declaredTableName(source: ModelSource): string {
  let contents = ''
  try {
    contents = readFileSync(source.file, 'utf8')
  }
  catch { /* unreadable; fall through to the name-derived default */ }

  const declared = contents.match(/^\s*table:\s*['"`]([^'"`]+)['"`]/m)
  if (declared?.[1])
    return declared[1].toLowerCase()

  const named = contents.match(/^\s*name:\s*['"`]([^'"`]+)['"`]/m)
  return plural(snakeCase(named?.[1] ?? source.name)).toLowerCase()
}

/**
 * Whether the framework's own models should be merged in ALONGSIDE userland's,
 * rather than only standing in when userland has none.
 *
 * Off by default (stacksjs/stacks#2220). An app that genuinely wants the union
 * — one that uses the built-in `User`, `Team` or commerce models without
 * publishing them into `app/Models` — turns it back on rather than living with
 * a schema it never asked for. `buddy publish model <Name>` is the other way
 * out, and the one that keeps the app's schema self-describing.
 *
 * The env var wins over config so a one-off generate can flip it without an
 * edit, matching `STACKS_MIGRATE_NO_RENAME` / `STACKS_MIGRATE_FROM_DB`.
 */
function shouldIncludeFrameworkDefaults(): boolean {
  const flag = process.env.STACKS_INCLUDE_FRAMEWORK_MODELS
  if (flag === '1' || flag === 'true')
    return true
  if (flag === '0' || flag === 'false')
    return false

  // Optional-chained rather than trusted: the generator also runs in contexts
  // (tests, programmatic migrations) where the config graph is only partly
  // booted. A miss degrades to the default, which is the conservative answer.
  return (config as any)?.database?.models?.includeFrameworkDefaults === true
}

/**
 * Resolve models from userland, falling back to the framework defaults.
 *
 * Returns `null` when neither root holds a model, which callers should treat as
 * "nothing to generate from" rather than as an error: it is the legitimate
 * state of a project that has not defined any models yet.
 */
export function resolveModelSources(options: {
  userRoot?: string
  frameworkRoot?: string
  /** Force the merge on or off, bypassing config and env. */
  includeFrameworkDefaults?: boolean
} = {}): ResolvedModelSources | null {
  const userRoot = options.userRoot ?? path.userModelsPath()
  const frameworkRoot = options.frameworkRoot ?? path.frameworkPath('defaults/app/Models')

  const user = collectModels(userRoot, 'user')
  const framework = collectModels(frameworkRoot, 'framework')

  if (user.length === 0 && framework.length === 0)
    return null

  const merge = options.includeFrameworkDefaults ?? shouldIncludeFrameworkDefaults()

  // Defaults are a fallback: they stand in only when userland has no models of
  // its own. Merging them made every app inherit the framework's demo schema
  // (stacksjs/stacks#2220).
  const useFramework = merge || user.length === 0
  const contributing = useFramework ? framework : []
  const excluded = useFramework ? [] : framework

  // Shadowing is detected against EVERY framework default, not just the ones
  // contributing models. The hazard it exists to report - a userland model
  // taking over a framework table's name while the framework's own code goes on
  // reading that table - does not depend on whether the default is in the
  // generator's scope. If anything it is sharper once defaults are excluded,
  // because then nothing else describes the table at all.
  const frameworkByName = new Map<string, ModelSource>()
  for (const model of framework) frameworkByName.set(model.name, model)

  const shadowed: ShadowedModel[] = []
  for (const model of user) {
    const replaced = frameworkByName.get(model.name)
    if (replaced)
      shadowed.push({ name: model.name, userFile: model.file, frameworkFile: replaced.file })
  }

  // Userland still overrides a framework model of the same name, which is what
  // the merge path is for.
  const byName = new Map<string, ModelSource>()
  for (const model of contributing) byName.set(model.name, model)
  for (const model of user) byName.set(model.name, model)

  const models = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))

  const roots: string[] = []
  if (user.length > 0)
    roots.push(userRoot)
  if (contributing.length > 0)
    roots.push(frameworkRoot)

  const excludedTables = [...new Set(excluded.map(declaredTableName))].sort()

  // Fast path: a single root whose models are all top level needs no staging,
  // so the common userland-only project keeps reading its own directory.
  const onlyUser = contributing.length === 0
  const allFlat = models.every(m => basename(join(m.file, '..')) === basename(onlyUser ? userRoot : frameworkRoot))
  if (roots.length === 1 && allFlat) {
    return { dir: roots[0]!, models, roots, staged: false, shadowed, excluded, excludedTables }
  }

  return { dir: stage(models), models, roots, staged: true, shadowed, excluded, excludedTables }
}

/** Remove the staging directory. Safe to call when it was never created. */
export function cleanupModelStaging(): void {
  const dir = modelStagingDir()
  try {
    if (existsSync(dir) && lstatSync(dir).isDirectory())
      rmSync(dir, { recursive: true, force: true })
  }
  catch { /* best effort */ }
}
