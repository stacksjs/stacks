/**
 * Class-based seeders.
 *
 * The legacy `seed()` flow walks every model and generates fake rows
 * from each attribute's factory — useful for "quick fill", but the
 * shape isn't great for staged data (e.g. a demo dataset where Posts
 * need specific Authors, or test fixtures that depend on each other).
 *
 * Class seeders give that escape hatch:
 *
 *   ```ts
 *   // database/seeders/PostSeeder.ts
 *   import { Seeder } from '@stacksjs/database'
 *   import Post from '~/app/Models/Post'
 *   import Author from '~/app/Models/Author'
 *
 *   export default class PostSeeder extends Seeder {
 *     async run() {
 *       const author = await Author.create({ name: 'Alice' })
 *       await Post.create({ title: 'Hello', authorId: author.id })
 *     }
 *   }
 *   ```
 *
 * Run with `buddy db:seed --class=PostSeeder` (one specific seeder)
 * or `buddy db:seed` (every class under `database/seeders/`).
 */

import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'

/**
 * Base class for class-based seeders. Subclass this and implement
 * `async run()`. Seeders may call `this.call()` to invoke other
 * seeders, mirroring Laravel's nested-seeder pattern.
 *
 * Cross-seeder ordering can be declared explicitly via `dependencies`:
 *
 *   ```ts
 *   export default class JudgeSeeder extends Seeder {
 *     dependencies = ['CourtHouseSeeder']
 *     async run() { ... }
 *   }
 *   ```
 *
 * The class name of each dependency is matched against the class names
 * `runClassSeeders` discovered in the seeders directory. Unknown
 * dependency names are warned about but don't fail the run (they may
 * refer to a model-factory seeder run earlier in `buddy seed`).
 *
 * When no `dependencies` are declared, seeders run in alphabetical
 * order — predictable across filesystems and good enough for projects
 * that name seeders by data flow (CourtHouse → Judge → Review).
 */
export abstract class Seeder {
  /**
   * Class names of seeders that must run before this one. Resolved
   * against the class seeders discovered in `database/seeders/`; the
   * runner builds a dependency DAG and topo-sorts before invoking
   * `run()` on each seeder.
   */
  dependencies?: string[]

  abstract run(): Promise<void> | void

  /**
   * Run another seeder class from inside this one. Useful for
   * orchestrating a graph of dependent seeders without `import` cycles.
   */
  protected async call(other: new () => Seeder): Promise<void> {
    // eslint-disable-next-line new-cap
    const inst = new other()
    await inst.run()
  }
}

interface RunOptions {
  /** Limit to a single seeder class (matches by class name). */
  class?: string
  /** Override the default `database/seeders/` directory. */
  dir?: string
}

/**
 * Topologically sort seeders by their declared `dependencies`. Ties
 * (and dependency-free seeders) come out in alphabetical order so the
 * result is deterministic across filesystems and runs.
 *
 * Unknown dependency names are dropped from the graph with a warning —
 * they may refer to model-factory seeders that ran earlier in the
 * `buddy seed` pipeline, or be stale references from a rename. The run
 * doesn't fail because of them.
 *
 * Cycles throw with the offending class names in the error message.
 *
 * Exported for testing.
 */
export function topoSortSeeders(
  seeders: Array<{ name: string, dependencies?: string[] }>,
): string[] {
  const known = new Set(seeders.map(s => s.name))

  // Effective deps: drop unknown refs (warn on each), de-duplicate, drop self-refs.
  const effectiveDeps = new Map<string, Set<string>>()
  for (const s of seeders) {
    const deps = new Set<string>()
    for (const dep of s.dependencies ?? []) {
      if (dep === s.name) continue
      if (!known.has(dep)) {
        log.warn(`[seeder] ${s.name} depends on '${dep}' but no seeder by that name was discovered — ignoring`)
        continue
      }
      deps.add(dep)
    }
    effectiveDeps.set(s.name, deps)
  }

  // Kahn's algorithm with alphabetical tie-breaking for stable output.
  const indegree = new Map<string, number>()
  const successors = new Map<string, Set<string>>()
  for (const s of seeders) {
    indegree.set(s.name, effectiveDeps.get(s.name)!.size)
    successors.set(s.name, new Set())
  }
  for (const s of seeders) {
    for (const dep of effectiveDeps.get(s.name)!)
      successors.get(dep)!.add(s.name)
  }

  const ready: string[] = seeders
    .filter(s => indegree.get(s.name) === 0)
    .map(s => s.name)
    .sort()

  const result: string[] = []
  while (ready.length > 0) {
    const next = ready.shift()!
    result.push(next)
    const newlyReady: string[] = []
    for (const succ of successors.get(next)!) {
      const left = (indegree.get(succ) ?? 0) - 1
      indegree.set(succ, left)
      if (left === 0) newlyReady.push(succ)
    }
    if (newlyReady.length > 0) {
      ready.push(...newlyReady)
      ready.sort()
    }
  }

  if (result.length !== seeders.length) {
    const unresolved = seeders.map(s => s.name).filter(n => !result.includes(n))
    throw new Error(
      `[seeder] Cycle in seeder \`dependencies\` among: ${unresolved.join(', ')}`,
    )
  }

  return result
}

/**
 * Discover and run class-based seeders. By default scans
 * `database/seeders/*.ts`; an explicit `--class` filters to one.
 *
 * Ordering:
 *   1. Files matching `*.ts` (excluding `_*.ts`) are imported.
 *   2. If any seeder declares `dependencies`, the runnable set is
 *      topologically sorted (alphabetical tie-break).
 *   3. Otherwise, the alphabetical order from `Array.sort()` wins —
 *      cheaper than the topo path and predictable across filesystems.
 *
 * Class-name filtering via `options.class` short-circuits both paths
 * and runs only that one seeder. Cross-seeder dependencies are NOT
 * resolved transitively in that mode — the caller takes responsibility
 * for whatever prereqs are needed.
 *
 * See stacksjs/stacks#1855 for the original report of unsorted FS
 * iteration producing zero-row seed runs.
 */
export async function runClassSeeders(options: RunOptions = {}): Promise<{ ran: string[], skipped: string[] }> {
  const dir = options.dir ?? path.projectPath('database/seeders')
  const ran: string[] = []
  const skipped: string[] = []

  if (!fs.existsSync(dir)) {
    log.info(`[seeder] No class seeders directory at ${dir}`)
    return { ran, skipped }
  }

  // Alphabetical sort is the default ordering; topo-sort below kicks in
  // if any seeder declares `dependencies`.
  const files = fs.readdirSync(dir)
    .filter((f: string) => f.endsWith('.ts') && !f.startsWith('_'))
    .sort()

  // First pass: import + instantiate every seeder so we can read
  // `dependencies` before deciding the run order. Failures here are
  // recorded as skips and excluded from the topo graph.
  interface Loaded {
    className: string
    inst: Seeder
  }
  const loaded: Loaded[] = []
  for (const file of files) {
    const className = file.replace(/\.ts$/, '')
    try {
      const mod = await import(`${dir}/${file}`)
      const Klass = mod.default ?? mod[className]
      if (!Klass) {
        log.warn(`[seeder] ${file} has no default export`)
        skipped.push(className)
        continue
      }
      // eslint-disable-next-line new-cap
      const inst = new Klass()
      if (typeof inst.run !== 'function') {
        log.warn(`[seeder] ${className} does not implement run()`)
        skipped.push(className)
        continue
      }
      loaded.push({ className, inst })
    }
    catch (err) {
      log.error(`[seeder] ${className} failed to load:`, err)
      skipped.push(className)
    }
  }

  // Decide run order. Toposort only when any seeder declares
  // dependencies — alphabetical is sufficient (and cheaper) otherwise.
  const declaresDeps = loaded.some(l => (l.inst.dependencies?.length ?? 0) > 0)
  let order: string[]
  if (declaresDeps) {
    try {
      order = topoSortSeeders(
        loaded.map(l => ({ name: l.className, dependencies: l.inst.dependencies })),
      )
    }
    catch (err) {
      // Cycle — fail loudly. Better than a confusing partial-success run.
      log.error(err instanceof Error ? err.message : String(err))
      return { ran, skipped: [...skipped, ...loaded.map(l => l.className)] }
    }
  }
  else {
    order = loaded.map(l => l.className)
  }

  const byName = new Map(loaded.map(l => [l.className, l.inst]))
  for (const className of order) {
    if (options.class && className !== options.class) {
      skipped.push(className)
      continue
    }
    const inst = byName.get(className)!
    try {
      log.info(`[seeder] Running ${className}…`)
      await inst.run()
      ran.push(className)
    }
    catch (err) {
      log.error(`[seeder] ${className} failed:`, err)
      skipped.push(className)
    }
  }

  return { ran, skipped }
}
