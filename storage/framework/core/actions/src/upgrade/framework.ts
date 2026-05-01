// This file is a script entry. We use `console.log` / `console.warn`
// deliberately (the script ends with `process.exit`, which fires before
// `@stacksjs/logging`'s async writes flush) and rely on top-level await
// to drive the sync pipeline.
/* eslint-disable no-console, ts/no-top-level-await */
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
import { downloadTemplate } from '@stacksjs/gitit'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import {
  buildTemplateString,
  detectLocalStacks,
  diffSnapshots,
  MANAGED_PATHS,
  readChannel,
  readVersion,
  resolveSuccessMessage,
  resolveUpgradeContext,
  resolveUpgradeMessage,
  snapshotTree,
  writeChannel,
  type ChangeSummary,
  type ManagedPath,
  type SnapshotEntry,
} from './framework-utils'

interface UpgradeOptions {
  version?: string
  canary?: boolean
  stable?: boolean
  force?: boolean
  /** Path to a local stacks checkout — short-circuits the GitHub download. */
  from?: string
  /** Skip the post-sync hooks (auto-imports / migrate / bun install). */
  noPostinstall?: boolean
  /** Run post-sync hooks (default true). Inverse of --no-postinstall. */
  postinstall?: boolean
}

const options = parseOptions() as UpgradeOptions

const projectRoot = p.projectPath()
const channelFile = join(projectRoot, '.stacks-channel')
const currentChannel = readChannel(channelFile)
const ctx = resolveUpgradeContext(options, currentChannel)

const corePkgPath = p.projectPath('storage/framework/core/buddy/package.json')
const currentVersion = readVersion(corePkgPath)

// Source resolution. Explicit `--from` wins. Otherwise auto-detect a sibling
// stacks checkout for instant offline updates. If neither is available,
// fall back to gitit (GitHub).
const explicitLocal = options.from ? p.projectPath(options.from) : null
const detectedLocal = explicitLocal ?? detectLocalStacks(projectRoot)
const usingLocal = !!detectedLocal

// User-facing status output. We use `console.log` directly (not the
// `@stacksjs/logging` facade) because the facade's writes are async — and
// this script ends with `process.exit`, which fires before async writes
// flush. The result was a silent script that looked like it did nothing.
console.log(resolveUpgradeMessage(ctx, currentChannel, !!options.stable))
console.log(usingLocal
  ? `  source: local checkout at ${detectedLocal}`
  : `  source: github:stacksjs/stacks#${ctx.ref}`)

// Pre-flight: warn (and abort, unless --force) if any managed path has
// uncommitted git changes. We don't want `update` to silently overwrite
// hand edits inside framework code.
if (!options.force) {
  const dirty = await detectDirtyManagedPaths(projectRoot)
  if (dirty.length > 0) {
    // Use console.warn (synchronous) — `log.warn` is async, and a follow-up
    // `process.exit` would run before its output flushed.
    console.warn('\n⚠ The following framework-managed paths have uncommitted changes:')
    for (const path of dirty) console.warn(`    - ${path}`)
    console.warn('\n  Aborting to avoid clobbering your edits.')
    console.warn('  Re-run with --force to overwrite, or commit / stash the changes first.\n')
    process.exit(ExitCode.FatalError)
  }
}

// Capture the running framework.ts's own content hash before we sync.
// If the upgrade pulls a newer version of THIS file (e.g. when an old
// app first lands on the multi-path sync), we re-execute against the
// new code so the user gets a single-shot upgrade. Without this hop,
// the old code finishes its narrow sync (typically just `core/`) and
// the user has to run `buddy update` a second time to pick up
// `defaults/` and post-sync hooks.
const ownPath = p.frameworkPath('core/actions/src/upgrade/framework.ts')
const ownHashBefore = await hashFileOrZero(ownPath)

// Sync each managed path. We snapshot file size + content hash before and
// after, so the summary reflects "actually changed" rather than "mtimes
// touched by cpSync".
const aggregate: ChangeSummary = { added: 0, changed: 0, removed: 0, unchanged: 0 }
const perPath: { managed: ManagedPath, summary: ChangeSummary }[] = []

try {
  for (const managed of MANAGED_PATHS) {
    const localTarget = join(projectRoot, managed.localPath)
    const before = managed.isFile
      ? await singleFileSnapshot(localTarget)
      : await snapshotTree(localTarget, managed.skip)

    if (usingLocal && detectedLocal) {
      await syncFromLocal(detectedLocal, managed, localTarget)
    }
    else {
      // gitit doesn't support copying single files, only template directories.
      // For root scripts, drop them through the temp-dir copy path further
      // below (kept simple: handled by `syncRootFilesFromGitHub`).
      if (managed.isFile) continue
      await syncFromGitHub(ctx.ref, managed, localTarget, !!options.force)
    }

    const after = managed.isFile
      ? await singleFileSnapshot(localTarget)
      : await snapshotTree(localTarget, managed.skip)
    const summary = diffSnapshots(before, after)
    aggregate.added += summary.added
    aggregate.changed += summary.changed
    aggregate.removed += summary.removed
    aggregate.unchanged += summary.unchanged
    perPath.push({ managed, summary })
  }

  // Root files (buddy / bootstrap) for the GitHub path. Skipped above; pulled
  // here in one shot via the same temp-dir mechanic the previous version used.
  if (!usingLocal) {
    await syncRootFilesFromGitHub(ctx.ref)
  }
}
catch (err: unknown) {
  console.error('✘ Failed to upgrade Stacks framework:', (err as Error)?.message || err)
  process.exit(ExitCode.FatalError)
}

const newVersion = readVersion(corePkgPath)

// If THIS file changed during the sync, re-exec against the new code so
// any newly added managed paths / post-sync hooks land in the same
// invocation. This is the single-shot bridge when a project upgrades
// from an old framework that didn't sync `defaults/` to the current
// version that does. We only restart once (`--__restarted` sentinel)
// to avoid pathological loops if the new code keeps disagreeing with
// itself somehow.
const ownHashAfter = await hashFileOrZero(ownPath)
const alreadyRestarted = process.argv.includes('--__restarted')
if (ownHashBefore !== 0n && ownHashAfter !== 0n && ownHashBefore !== ownHashAfter && !alreadyRestarted) {
  console.log('Upgrade pulled a newer version of the upgrade action — re-running once to pick up new sync paths and hooks.\n')
  // Forward the user's original args plus the sentinel.
  const args = process.argv.slice(2).filter(a => a !== '--__restarted')
  const proc = Bun.spawn({
    // Use `Bun.argv0` so the restart runs under the same bun binary the
    // parent is using — important when pantry's vendored bun is the
    // active runtime but the system PATH points at a different version.
    cmd: [Bun.argv0 || 'bun', ownPath, ...args, '--__restarted'],
    cwd: projectRoot,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const code = await proc.exited
  process.exit(code ?? 0)
}

// Persist channel choice (not when pinning a specific version).
if (!ctx.targetVersion)
  writeChannel(channelFile, ctx.channel)

console.log(`✔ ${resolveSuccessMessage(ctx, currentVersion, newVersion, currentChannel, !!options.force)}`)

// Per-path summary — useful when an update touches >1 area so the user can
// see "ah, defaults moved a lot too".
console.log('Sync summary:')
for (const { managed, summary } of perPath) {
  if (managed.isFile) {
    const moved = summary.added + summary.changed > 0
    console.log(`  ${managed.label.padEnd(10)} ${moved ? 'updated' : 'unchanged'}`)
  }
  else {
    // Collapse no-op paths to a single "unchanged" line so identical-content
    // updates don't read as noisy "+0 ~0 -0" output.
    const noop = summary.added + summary.changed + summary.removed === 0
    if (noop) {
      console.log(`  ${managed.label.padEnd(10)} unchanged (${summary.unchanged} files)`)
    }
    else {
      console.log(
        `  ${managed.label.padEnd(10)} +${summary.added} ~${summary.changed} -${summary.removed} (${summary.unchanged} unchanged)`,
      )
    }
  }
}

// Post-sync hooks. Run by default — the whole point of `buddy update` being
// dead simple is that the user shouldn't have to chase follow-up commands.
const runHooks = !options.noPostinstall && options.postinstall !== false
if (runHooks) {
  await runPostSyncHooks({ aggregate, perPath, projectRoot })
}

if (ctx.channel === 'canary' && !ctx.targetVersion) {
  console.warn('⚠ Canary builds may contain bugs or breaking changes. Not recommended for production.')
}

process.exit(ExitCode.Success)

// ===========================================================================
// helpers
// ===========================================================================

async function detectDirtyManagedPaths(root: string): Promise<string[]> {
  // If we're not in a git repo, there's nothing to check — treat as clean.
  const gitDir = join(root, '.git')
  if (!existsSync(gitDir)) return []

  try {
    const proc = Bun.spawn({
      cmd: ['git', '-C', root, 'status', '--porcelain', '--', ...MANAGED_PATHS.map(m => m.localPath)],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited

    return output
      .split('\n')
      .filter(line => line.length > 0)
      // Porcelain format: 2-char status + space + path (e.g. " M storage/...",
      // "?? bootstrap"). DON'T trim() first — it strips the leading space and
      // throws off the slice. Just chop the fixed 3-char prefix.
      .map(line => line.slice(3))
  }
  catch {
    // git missing or other failure — don't block the update.
    return []
  }
}

async function hashFileOrZero(absPath: string): Promise<bigint> {
  try {
    if (!existsSync(absPath)) return 0n
    const buf = await Bun.file(absPath).arrayBuffer()
    return Bun.hash(buf) as bigint
  }
  catch {
    return 0n
  }
}

async function singleFileSnapshot(absPath: string): Promise<Map<string, SnapshotEntry>> {
  const out = new Map<string, SnapshotEntry>()
  if (!existsSync(absPath)) return out
  try {
    const file = Bun.file(absPath)
    if (file.size > 0) {
      const buf = await file.arrayBuffer()
      out.set('self', { size: file.size, hash: Bun.hash(buf) as bigint })
    }
  }
  catch {
    // ignore — empty snapshot signals "no prior file"
  }
  return out
}

async function syncFromLocal(stacksRoot: string, managed: ManagedPath, localTarget: string): Promise<void> {
  const src = join(stacksRoot, managed.subPath)
  if (!existsSync(src)) {
    console.warn(`  skip ${managed.label}: source missing at ${src}`)
    return
  }

  if (managed.isFile) {
    mkdirSync(dirname(localTarget), { recursive: true })
    copyFileSync(src, localTarget)
    return
  }

  // Directory copy. `cpSync` with `recursive: true` is roughly equivalent to
  // `cp -R src/. dest/`. We don't pre-clean the target — that would delete
  // user-generated files like `.discovered-models.json` and force a full
  // re-bootstrap on every update. Files removed upstream will become orphans
  // locally; that's an acceptable cost for the "dead simple" promise.
  mkdirSync(localTarget, { recursive: true })
  cpSync(src, localTarget, {
    recursive: true,
    force: true,
    filter: (source) => {
      if (!managed.skip) return true
      const name = source.split('/').pop() || ''
      return !managed.skip.includes(name)
    },
  })
}

async function syncFromGitHub(ref: string, managed: ManagedPath, localTarget: string, force: boolean): Promise<void> {
  const template = buildTemplateString(ref, managed.subPath)
  await downloadTemplate(template, {
    dir: localTarget,
    force: true,
    forceClean: false,
    preferOffline: !force,
  })
}

async function syncRootFilesFromGitHub(ref: string): Promise<void> {
  const tmpDir = p.projectPath('.tmp-upgrade')

  try {
    await downloadTemplate(`github:stacksjs/stacks#${ref}`, {
      dir: tmpDir,
      force: true,
      forceClean: true,
      preferOffline: true,
      silent: true,
    })

    for (const managed of MANAGED_PATHS) {
      if (!managed.isFile) continue
      const src = join(tmpDir, managed.subPath)
      const dest = p.projectPath(managed.localPath)
      try {
        if (existsSync(src) && existsSync(dest))
          copyFileSync(src, dest)
      }
      catch {
        // best-effort
      }
    }
  }
  catch {
    // root-file updates are best-effort and shouldn't fail the whole upgrade
  }
  finally {
    if (existsSync(tmpDir))
      rmSync(tmpDir, { recursive: true, force: true })
  }
}

async function runPostSyncHooks(args: {
  aggregate: ChangeSummary
  perPath: { managed: ManagedPath, summary: ChangeSummary }[]
  projectRoot: string
}): Promise<void> {
  const { aggregate, perPath, projectRoot } = args

  if (aggregate.added + aggregate.changed + aggregate.removed === 0) {
    console.log('Nothing changed — skipping post-sync hooks.')
    return
  }

  // 1) Auto-import manifest. Newly added default actions / models / functions
  //    won't be visible to the framework until we regenerate the manifest at
  //    storage/framework/auto-imports/. The dev server also does this on
  //    boot, but doing it here means the next `buddy <something>` invocation
  //    just works without an extra step.
  console.log('Regenerating auto-import manifest...')
  try {
    const { generateAutoImportFiles } = await import('@stacksjs/server')
    await generateAutoImportFiles()
  }
  catch (err) {
    console.warn(`  auto-imports failed (non-fatal): ${(err as Error)?.message || err}`)
  }

  // 2) `bun install` if any synced package.json changed. Updating core/
  //    pulls new framework package versions; the user's lockfile won't know
  //    about them until install is re-run. We only run install if a
  //    package.json moved, so no-op upgrades stay fast.
  const corePkgChanged = perPath.some((entry) => {
    const { managed, summary } = entry
    if (managed.isFile) return false
    if (managed.label !== 'core' && managed.label !== 'defaults') return false
    if (summary.added + summary.changed === 0) return false
    return pkgJsonInTree(join(projectRoot, managed.localPath))
  })
  if (corePkgChanged) {
    console.log('Running `bun install` to refresh dependencies...')
    try {
      const proc = Bun.spawn({
        cmd: [Bun.argv0 || 'bun', 'install'],
        cwd: projectRoot,
        stdout: 'inherit',
        stderr: 'inherit',
      })
      const code = await proc.exited
      if (code !== 0)
        console.warn(`  bun install exited with code ${code} (non-fatal)`)
    }
    catch (err) {
      console.warn(`  bun install failed (non-fatal): ${(err as Error)?.message || err}`)
    }
  }

  // 3) Run pending migrations. Idempotent — Stacks tracks applied migrations
  //    in the migrations table, so re-running on a fully-migrated DB is a
  //    no-op. Skip if no migration files exist (fresh app, no DB yet).
  const migrationsDir = join(projectRoot, 'database', 'migrations')
  if (existsSync(migrationsDir)) {
    console.log('Running pending migrations...')
    try {
      const migrateScript = p.frameworkPath('core/buddy/src/cli.ts')
      const proc = Bun.spawn({
        cmd: [Bun.argv0 || 'bun', migrateScript, 'migrate'],
        cwd: projectRoot,
        stdout: 'inherit',
        stderr: 'inherit',
      })
      const code = await proc.exited
      if (code !== 0)
        console.warn(`  migrate exited with code ${code} (non-fatal — DB may not be set up yet)`)
    }
    catch (err) {
      console.warn(`  migrate failed (non-fatal): ${(err as Error)?.message || err}`)
    }
  }
}

function pkgJsonInTree(dir: string): boolean {
  // Cheap check: a top-level package.json is the common case (e.g. core/
  // has core/buddy/package.json one level down). If we don't see one at the
  // root, treat the tree as having packages anyway — false negatives on
  // `bun install` are worse than false positives.
  try {
    if (!existsSync(dir)) return false
    const top = readFileSync(join(dir, 'package.json'), 'utf-8')
    return top.length > 0
  }
  catch {
    return existsSync(dir)
  }
}
