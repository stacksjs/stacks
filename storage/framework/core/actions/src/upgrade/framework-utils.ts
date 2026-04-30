import type { Stats } from 'node:fs'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

export interface UpgradeContext {
  channel: 'stable' | 'canary'
  ref: string
  targetVersion?: string
}

/**
 * Resolve the target channel and git ref from CLI options and persisted channel.
 * Priority: --version > --canary > --stable > persisted channel
 */
export function resolveUpgradeContext(options: {
  version?: string
  canary?: boolean
  stable?: boolean
}, currentChannel: 'stable' | 'canary'): UpgradeContext {
  const targetVersion = options.version

  if (targetVersion) {
    // Specific version requested — use the git tag
    // Support both "0.70.23" and "v0.70.23"
    const ref = targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`
    return { channel: 'stable', ref, targetVersion }
  }

  if (options.canary) {
    return { channel: 'canary', ref: 'canary' }
  }

  if (options.stable) {
    return { channel: 'stable', ref: 'main' }
  }

  if (currentChannel === 'canary') {
    // Stay on canary if already on canary (like bun upgrade on canary stays on canary)
    return { channel: 'canary', ref: 'canary' }
  }

  return { channel: 'stable', ref: 'main' }
}

/**
 * Build the gitit template string for a path under the stacks repo.
 * `subPath` is relative to the repo root (e.g. `storage/framework/core`).
 */
export function buildTemplateString(ref: string, subPath = 'storage/framework/core'): string {
  return `github:stacksjs/stacks#${ref}/${subPath}`
}

/**
 * Read a version from a package.json file. Returns null on any error.
 */
export function readVersion(pkgPath: string): string | null {
  try {
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      return pkg.version || null
    }
  }
  catch {
    // best-effort
  }

  return null
}

/**
 * Read the persisted channel from the channel file.
 */
export function readChannel(channelFilePath: string): 'stable' | 'canary' {
  try {
    if (existsSync(channelFilePath)) {
      const content = readFileSync(channelFilePath, 'utf-8').trim()
      if (content === 'canary')
        return 'canary'
    }
  }
  catch {
    // best-effort
  }

  return 'stable'
}

/**
 * Persist the channel to the channel file.
 */
export function writeChannel(channelFilePath: string, ch: 'stable' | 'canary'): void {
  try {
    writeFileSync(channelFilePath, ch, 'utf-8')
  }
  catch {
    // best-effort
  }
}

/**
 * Determine the user-facing log message for the upgrade action.
 */
export function resolveUpgradeMessage(ctx: UpgradeContext, currentChannel: 'stable' | 'canary', isStableFlag: boolean): string {
  if (ctx.targetVersion) {
    return `Installing Stacks v${ctx.targetVersion.replace(/^v/, '')}...`
  }

  if (ctx.channel === 'canary') {
    return 'Upgrading to the latest canary build...'
  }

  if (isStableFlag && currentChannel === 'canary') {
    return 'Switching back to the latest stable release...'
  }

  return 'Upgrading to the latest version...'
}

/**
 * Determine the user-facing success message after an upgrade.
 */
export function resolveSuccessMessage(ctx: UpgradeContext, currentVersion: string | null, newVersion: string | null, currentChannel: 'stable' | 'canary', force: boolean): string {
  if (ctx.targetVersion) {
    const pinned = ctx.targetVersion.replace(/^v/, '')

    if (currentVersion === pinned && !force) {
      return `Stacks is already at v${pinned}`
    }

    if (currentVersion) {
      return `Installed Stacks v${pinned} (was v${currentVersion})`
    }

    return `Installed Stacks v${pinned}`
  }

  if (currentVersion && newVersion && currentVersion === newVersion && !force) {
    if (ctx.channel === 'canary') {
      return `Stacks is already up to date (canary ${currentVersion})`
    }

    return `Stacks is already up to date (v${currentVersion})`
  }

  if (currentVersion && newVersion) {
    const from = currentChannel === 'canary' ? `canary ${currentVersion}` : `v${currentVersion}`
    const to = ctx.channel === 'canary' ? `canary ${newVersion}` : `v${newVersion}`
    return `Upgraded Stacks from ${from} to ${to}`
  }

  if (newVersion) {
    const label = ctx.channel === 'canary' ? `canary ${newVersion}` : `v${newVersion}`
    return `Upgraded Stacks to ${label}`
  }

  return `Upgraded Stacks to ${ctx.ref} (latest)`
}

/**
 * Framework-managed paths, relative to the project root, that `buddy update`
 * keeps in sync with the upstream stacks repo. Each entry can be a directory
 * (synced recursively) or a single file. The `subPath` is the path inside the
 * upstream stacks checkout — almost always the same as `localPath`, except
 * for root scripts that live at the project root in apps but at the repo root
 * in the stacks monorepo.
 */
export interface ManagedPath {
  /** Path inside the user's stacks app, relative to project root. */
  localPath: string
  /** Path inside the upstream stacks repo, relative to repo root. */
  subPath: string
  /** True for single-file targets (e.g. the root `buddy` script). */
  isFile?: boolean
  /** Directory entries to skip when copying — generated/cache files we don't want to overwrite. */
  skip?: string[]
  /** Human label shown in the upgrade summary. */
  label: string
}

export const MANAGED_PATHS: ManagedPath[] = [
  {
    localPath: 'storage/framework/core',
    subPath: 'storage/framework/core',
    label: 'core',
    // Lockfiles + dist are derivative — leave whatever the user has in place.
    skip: ['node_modules', 'dist', 'bun.lock', '.DS_Store'],
  },
  {
    localPath: 'storage/framework/defaults',
    subPath: 'storage/framework/defaults',
    label: 'defaults',
    // `.discovered-models.json` is regenerated locally on `buddy dev`.
    // Don't clobber it during update.
    skip: ['node_modules', 'dist', '.DS_Store', '.discovered-models.json'],
  },
  { localPath: 'buddy', subPath: 'buddy', label: 'buddy', isFile: true },
  { localPath: 'bootstrap', subPath: 'bootstrap', label: 'bootstrap', isFile: true },
]

/**
 * Auto-detect a local stacks checkout the user might be developing against.
 *
 * Order:
 *   1. `STACKS_LOCAL_PATH` env var (explicit)
 *   2. Sibling directory: `<project>/../stacks`
 *   3. `~/Code/stacks` and a few common dev paths
 *
 * Returns null if nothing looks like a stacks checkout. We confirm by checking
 * for `storage/framework/core/buddy/package.json` — the canonical marker.
 */
export function detectLocalStacks(projectRoot: string): string | null {
  const candidates = [
    process.env.STACKS_LOCAL_PATH,
    resolve(projectRoot, '..', 'stacks'),
    resolve(projectRoot, '..', '..', 'stacks'),
    resolve(homedir(), 'Code', 'stacks'),
    resolve(homedir(), 'code', 'stacks'),
    resolve(homedir(), 'projects', 'stacks'),
    resolve(homedir(), 'src', 'stacks'),
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const marker = join(candidate, 'storage', 'framework', 'core', 'buddy', 'package.json')
    try {
      if (existsSync(marker) && resolve(candidate) !== resolve(projectRoot))
        return resolve(candidate)
    }
    catch {
      // unreadable / permission denied — keep looking
    }
  }

  return null
}

/**
 * Snapshot entry. We capture size + content hash at snapshot time so the
 * before/after diff can detect "actually changed" vs "just re-copied with
 * fresh mtimes". `cpSync` and `downloadTemplate` always touch mtimes,
 * even when the destination bytes are identical to the source — using
 * mtime as the change signal turns every no-op upgrade into a "1600
 * changed" report.
 */
export interface SnapshotEntry {
  /** File size in bytes — fast-path equality check. */
  size: number
  /** xxh3 content hash captured at snapshot time. 0n on read failure. */
  hash: bigint
}

/**
 * Walk a directory recursively and return a Map of relative-path → entry,
 * with each entry's size + content hash captured at the time of the call.
 * Hashing the entire tree at snapshot time (rather than at diff time) means
 * the "before" snapshot stays valid even after `cpSync` overwrites the
 * files in place.
 *
 * Async because we read each file via `Bun.file().arrayBuffer()`. On a
 * 3000-file framework tree this completes in ~50ms — `Bun.hash` is xxh3,
 * not a crypto hash, and the I/O is fully parallelized.
 */
export async function snapshotTree(root: string, skip: string[] = []): Promise<Map<string, SnapshotEntry>> {
  const out = new Map<string, SnapshotEntry>()
  if (!existsSync(root)) return out

  const skipSet = new Set(skip)
  const stack: { abs: string, rel: string }[] = [{ abs: root, rel: '' }]
  const hashJobs: Promise<void>[] = []

  while (stack.length > 0) {
    const { abs, rel } = stack.pop()!
    let entries: string[]
    try {
      entries = readdirSync(abs)
    }
    catch {
      continue
    }

    for (const name of entries) {
      if (skipSet.has(name)) continue
      const childAbs = join(abs, name)
      const childRel = rel ? `${rel}/${name}` : name

      let info: Stats
      try {
        info = statSync(childAbs)
      }
      catch {
        continue
      }

      if (info.isDirectory()) {
        stack.push({ abs: childAbs, rel: childRel })
      }
      else if (info.isFile()) {
        const size = info.size
        // Kick off the hash without awaiting — we batch them all, then
        // await once at the end to parallelize I/O across the tree.
        hashJobs.push((async () => {
          const hash = await hashFile(childAbs)
          out.set(childRel, { size, hash })
        })())
      }
    }
  }

  await Promise.all(hashJobs)
  return out
}

export interface ChangeSummary {
  added: number
  changed: number
  removed: number
  unchanged: number
}

/**
 * Diff two snapshots produced by `snapshotTree`. Pure comparison — both
 * inputs already carry their content hash, so this is just bookkeeping.
 */
export function diffSnapshots(
  before: Map<string, SnapshotEntry>,
  after: Map<string, SnapshotEntry>,
): ChangeSummary {
  let added = 0
  let changed = 0
  let unchanged = 0

  for (const [rel, info] of after) {
    const prev = before.get(rel)
    if (!prev) added++
    else if (prev.size !== info.size || prev.hash !== info.hash) changed++
    else unchanged++
  }

  let removed = 0
  for (const rel of before.keys()) {
    if (!after.has(rel)) removed++
  }

  return { added, changed, removed, unchanged }
}

async function hashFile(absPath: string): Promise<bigint> {
  try {
    const buf = await Bun.file(absPath).arrayBuffer()
    return Bun.hash(buf) as bigint
  }
  catch {
    // Read failure → sentinel hash. Two reads with the same failure produce
    // the same sentinel and would compare equal, but that's fine: an
    // unreadable file isn't really "changed" in any actionable sense.
    return 0n
  }
}
