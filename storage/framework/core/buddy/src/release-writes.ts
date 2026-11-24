/**
 * What an app writes inside its own release, and so loses on the next deploy
 * (stacksjs/stacks#3367).
 *
 * A server app runs from `/var/www/<site>/releases/<id>`, and the next deploy
 * replaces that directory. Only what `sharedPaths` names is kept: the
 * framework declares the database and `storage/logs` (see
 * `applyPersistentStatePaths` in commands/deploy.ts). Anything else written on
 * the box (uploads in `storage/app`, generated media, a file cache) dies with
 * its release, and nothing said so. Postline lost every queued image that way.
 *
 * Two warnings now say so. Both only warn: deciding what to keep is the app's
 * call, made in config/cloud.ts.
 *
 * - {@link releaseTreeStorageWarnings}, before anything is uploaded, from the
 *   configuration: the local storage disk defaults to `storage/app` inside the
 *   release.
 * - {@link releaseWritesCommand}, on the box, from what actually happened: the
 *   new release's preStart lists the files the outgoing release wrote while it
 *   was live. That catches a directory the app picked itself, which no
 *   configuration names.
 */

import { isAbsolute } from 'node:path'

/** Touched when a release goes live, so the next deploy can tell what it wrote since. */
export const RELEASE_LIVE_MARKER = '.stacks-release-live'

/**
 * Directories a release rebuilds or caches, where losing what was written
 * costs nothing. Shared paths need no entry: they are symlinks, and `find`
 * does not follow them.
 */
const REBUILT = ['node_modules', '.git', 'storage/framework/stx', 'storage/framework/runtime', 'storage/framework/cache']

/**
 * The preStart step that warns about the outgoing release's writes, then marks
 * the new release live.
 *
 * ts-cloud runs preStart under `set -euo pipefail` from inside the new
 * release, with `../../current` still pointing at the release being replaced.
 * The step cannot fail the deploy: a warning is not worth a release. It is
 * shell rather than a buddy command, so it costs no boot and works however the
 * site invokes buddy.
 *
 * It runs last in preStart, so what the new release's own preStart writes
 * (dependencies, a migrated schema) is older than its marker.
 */
export function releaseWritesCommand(): string {
  const prune = REBUILT.map(dir => `-path ./${dir}`).join(' -o ')
  const listWrites = `(cd ../../current && find . \\( ${prune} \\) -prune -o -type f -newer ${RELEASE_LIVE_MARKER} ! -name ${RELEASE_LIVE_MARKER} -print 2>/dev/null)`
  // Group by the first two path segments: `storage/app/postline-media/a.png`
  // counts toward `storage/app`.
  const summarize = `sed -E 's#^\\./##; s#^([^/]+/[^/]+)/.*#\\1#' | sort | uniq -c | sort -rn | head -n 20`
  const warning = 'WARNING: the release this deploy replaces wrote these files inside its own release directory while it was live. The release going live now does not have them, and they are deleted when the old release is pruned. Keep a directory with sharedPaths in config/cloud.ts, or write it outside the release (stacksjs/stacks#3367):'
  return [
    `if [ -f ../../current/${RELEASE_LIVE_MARKER} ] && [ "$(cd ../../current && pwd -P)" != "$(pwd -P)" ]; then`,
    `stacks_written=$({ ${listWrites} | ${summarize}; } || true);`,
    `if [ -n "$stacks_written" ]; then echo '${warning}'; printf '%s\\n' "$stacks_written" | sed 's/^/  /'; fi;`,
    `fi; touch ${RELEASE_LIVE_MARKER} || true`,
  ].join(' ')
}

/** A site ts-cloud runs as a process on the box: it has a start command. */
function runsOnBox(site: any): boolean {
  return !!site && typeof site.start === 'string'
}

/**
 * End every server app's preStart with {@link releaseWritesCommand}. Static
 * and bucket sites write nothing on the box, so they are left alone.
 * Idempotent.
 */
export function applyReleaseWriteCheck<T extends Record<string, any>>(sites: T): T {
  const step = releaseWritesCommand()
  const out: Record<string, any> = {}
  for (const [name, site] of Object.entries(sites)) {
    if (!runsOnBox(site)) {
      out[name] = site
      continue
    }
    const preStart: unknown[] = Array.isArray(site.preStart) ? [...site.preStart] : []
    if (!preStart.includes(step))
      preStart.push(step)
    out[name] = { ...site, preStart }
  }
  return out as T
}

/** Does a site's sharedPaths keep `dir` (or a directory above it)? */
function keeps(site: any, dir: string): boolean {
  const declared: unknown[] = Array.isArray(site.sharedPaths) ? site.sharedPaths : []
  return declared.some((entry) => {
    const path = typeof entry === 'string' ? entry : (entry as { path?: unknown } | null)?.path
    if (typeof path !== 'string')
      return false
    const clean = path.replace(/^\.\//, '').replace(/\/+$/, '')
    return dir === clean || dir.startsWith(`${clean}/`)
  })
}

/**
 * What the configuration says will be written inside the release and lost.
 *
 * The local disks are rooted at `filesystems.root`, which is `STORAGE_ROOT` or
 * the working directory, and a server app's working directory is its release.
 * So with the default local driver, `Storage.put()` writes to
 * `<release>/storage/app`. Read from each site's resolved env, after the
 * production env file is merged in.
 */
export function releaseTreeStorageWarnings(sites: Record<string, any>): string[] {
  const warnings: string[] = []
  for (const [name, site] of Object.entries(sites)) {
    if (!runsOnBox(site))
      continue
    const env: Record<string, unknown> = site.env ?? {}
    const root = typeof env.STORAGE_ROOT === 'string' ? env.STORAGE_ROOT.trim() : ''
    if (root && isAbsolute(root))
      continue
    const driver = String(env.STORAGE_DRIVER || 'local')

    if (driver === 'local' && !keeps(site, 'storage/app')) {
      warnings.push(`Site "${name}": the local storage disk writes to storage/app inside each release, and the next deploy drops what it holds. If this app stores files there, add 'storage/app' to the site's sharedPaths in config/cloud.ts, set STORAGE_ROOT to a directory outside the release, or use a remote disk.`)
    }
    else if (driver === 'public') {
      // public/ also holds the assets each release ships, so sharing it would
      // serve the previous release's build.
      warnings.push(`Site "${name}": the public storage disk writes to public/ inside each release, and the next deploy drops what was written there. Sharing public/ would also pin the previous build's assets, so set STORAGE_ROOT to a directory outside the release, or use a remote disk.`)
    }
  }
  return warnings
}
