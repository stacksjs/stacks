import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * The nearest ancestor of `start` that carries `marker`, or undefined.
 *
 * Counting `..` was the old approach and it only held for one call site.
 * `dev/defaults-resources.ts` sits six levels under the project root, so
 * `resolve(import.meta.dir, '../../../../../..')` was right for the dev server
 * and wrong for anything else that ends up importing it. A deployed app starts
 * from a BUNDLE at `storage/framework/runtime/production/serve.js`, four levels
 * down, where six levels up lands two directories ABOVE the project. The
 * vendored check then missed, the published `@stacksjs/defaults` was taken
 * instead, and production served the last release's default views rather than
 * the app's own: every default view, layout and component added since that
 * release silently absent, with nothing logged. That is how stacksjs.com came
 * to answer a 404 with stx's generic page while its own errors/404.stx sat
 * shipped on the box, unread.
 *
 * Searching for the marker has no depth to get wrong. The walk starts inside
 * the framework being used, so the first checkout it finds is the one whose
 * code is running.
 */
function nearestContaining(start: string, marker: string): string | undefined {
  let dir = start

  while (true) {
    const candidate = join(dir, marker)
    if (existsSync(candidate))
      return candidate

    const parent = dirname(dir)
    if (parent === dir)
      return undefined

    dir = parent
  }
}

/**
 * Resolve the framework's default resources root — the fallback views, layouts
 * and components a server renders under an app's own.
 *
 * A vendored checkout keeps them at `storage/framework/defaults/resources` and
 * wins, so a full framework checkout behaves exactly as before. An app that
 * consumes the framework from node_modules has no vendored copy — that directory
 * is generated and gitignored, so `git ls-files storage/framework` is empty on a
 * fresh clone — and must resolve the published `@stacksjs/defaults` package
 * instead. Without this fallback the dev server pointed every default at a path
 * that does not exist until `buddy setup` has run (stacksjs/stacks#2240).
 *
 * The production server (core/buddy's production-server.ts) already resolved it
 * this way; the dev server still had the bare path. This is the shared shape —
 * import it from both rather than keep two copies that can drift.
 *
 * Returns an absolute path either way. It used to hand back the bare relative
 * string, which only resolved for a caller whose working directory was already
 * the project root.
 *
 * Returns the vendored path if neither resolves, letting the caller (stx serve)
 * surface a clear missing-directory error rather than a silent empty glob.
 */
export function resolveDefaultsRoot(): string {
  const vendored = nearestContaining(import.meta.dir, 'storage/framework/defaults')
    ?? nearestContaining(process.cwd(), 'storage/framework/defaults')

  if (vendored)
    return vendored

  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    return dirname(pkgJson)
  }
  catch {
    // Neither resolved. Naming a path under the working directory at least
    // points the missing-directory error somewhere the reader recognises.
    return join(process.cwd(), 'storage/framework/defaults')
  }
}

export function resolveDefaultsResources(): string {
  /*
   * Located from this file, not the working directory.
   *
   * `existsSync('storage/framework/defaults/resources')` asks about a path
   * relative to wherever the process happens to have been started. From the
   * framework root that is the vendored copy and everything works; from any
   * subdirectory the check fails, the package fallback is taken instead, and
   * the dev server quietly serves the generated `core/defaults` copy rather
   * than the source of truth it was pointed at. Running the suite from inside
   * `core/actions` is enough to see it.
   *
   * Found by looking for the directory rather than by counting levels up from
   * this file: this module gets bundled, and the bundle does not sit where the
   * source does. See `nearestContaining` above.
   */
  const vendored = nearestContaining(import.meta.dir, 'storage/framework/defaults/resources')
    ?? nearestContaining(process.cwd(), 'storage/framework/defaults/resources')

  if (vendored)
    return vendored

  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    return join(dirname(pkgJson), 'resources')
  }
  catch {
    return join(process.cwd(), 'storage/framework/defaults/resources')
  }
}
