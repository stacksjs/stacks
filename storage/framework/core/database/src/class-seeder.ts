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
 */
export abstract class Seeder {
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
 * Discover and run class-based seeders. By default scans
 * `database/seeders/*.ts`; an explicit `--class` filters to one.
 */
export async function runClassSeeders(options: RunOptions = {}): Promise<{ ran: string[], skipped: string[] }> {
  const dir = options.dir ?? path.projectPath('database/seeders')
  const ran: string[] = []
  const skipped: string[] = []

  if (!fs.existsSync(dir)) {
    log.info(`[seeder] No class seeders directory at ${dir}`)
    return { ran, skipped }
  }

  const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.ts') && !f.startsWith('_'))
  for (const file of files) {
    const className = file.replace(/\.ts$/, '')
    if (options.class && className !== options.class) {
      skipped.push(className)
      continue
    }
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
