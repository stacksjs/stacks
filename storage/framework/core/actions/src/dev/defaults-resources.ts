import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

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
 * Returns the vendored path if neither resolves, letting the caller (stx serve)
 * surface a clear missing-directory error rather than a silent empty glob.
 */
export function resolveDefaultsResources(): string {
  const vendored = 'storage/framework/defaults/resources'
  if (existsSync(vendored))
    return vendored

  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    return join(dirname(pkgJson), 'resources')
  }
  catch {
    return vendored
  }
}
