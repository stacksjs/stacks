/**
 * Resolve the model definitions the migration generator should read.
 *
 * Two problems this exists to solve.
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
 * So models from both roots are collected recursively and staged into one flat
 * directory that bqb can read completely. Userland wins on a name collision, so
 * an app can still override a framework model.
 */

import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { path } from '@stacksjs/path'

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
   */
  shadowed: ShadowedModel[]
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
 * Resolve models from userland and framework defaults.
 *
 * Returns `null` when neither root holds a model, which callers should treat as
 * "nothing to generate from" rather than as an error: it is the legitimate
 * state of a project that has not defined any models yet.
 */
export function resolveModelSources(options: { userRoot?: string, frameworkRoot?: string } = {}): ResolvedModelSources | null {
  const userRoot = options.userRoot ?? path.userModelsPath()
  const frameworkRoot = options.frameworkRoot ?? path.frameworkPath('defaults/app/Models')

  const user = collectModels(userRoot, 'user')
  const framework = collectModels(frameworkRoot, 'framework')

  if (user.length === 0 && framework.length === 0)
    return null

  // Userland overrides a framework model of the same name.
  const byName = new Map<string, ModelSource>()
  for (const model of framework) byName.set(model.name, model)

  const shadowed: ShadowedModel[] = []
  for (const model of user) {
    const replaced = byName.get(model.name)
    if (replaced?.origin === 'framework')
      shadowed.push({ name: model.name, userFile: model.file, frameworkFile: replaced.file })

    byName.set(model.name, model)
  }

  const models = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))

  const roots: string[] = []
  if (user.length > 0)
    roots.push(userRoot)
  if (framework.length > 0)
    roots.push(frameworkRoot)

  // Fast path: a single root whose models are all top level needs no staging,
  // so the common userland-only project keeps reading its own directory.
  const onlyUser = framework.length === 0
  const allFlat = models.every(m => basename(join(m.file, '..')) === basename(onlyUser ? userRoot : frameworkRoot))
  if (roots.length === 1 && allFlat) {
    return { dir: roots[0]!, models, roots, staged: false, shadowed }
  }

  return { dir: stage(models), models, roots, staged: true, shadowed }
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
