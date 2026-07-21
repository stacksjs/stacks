// This file is a script entry. We use `console.log` / `console.warn`
// deliberately (the script ends with `process.exit`, which fires before
// `@stacksjs/logging`'s async writes flush) and rely on top-level await
// to drive the sync pipeline.
/* eslint-disable no-console, ts/no-top-level-await */
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
  diffSnapshotsDetailed,
  MANAGED_PATHS,
  readChannel,
  readSyncedVersion,
  readVersion,
  resolveSuccessMessage,
  resolveUpgradeContext,
  resolveUpgradeMessage,
  shouldAutoDetectLocalStacks,
  shouldShortCircuit,
  snapshotTree,
  writeChannel,
  writeSyncedVersion,
  type ChangeSummary,
  type ManagedPath,
  type SnapshotEntry,
  type UpgradeContext,
} from './framework-utils'
import { runPostSyncMigration } from './framework-hooks'

interface UpgradeOptions {
  version?: string
  canary?: boolean
  stable?: boolean
  force?: boolean
  /** Path to a local stacks checkout — short-circuits the GitHub download. */
  from?: string
  /** Preview the upgrade (list what would change) without writing, installing, or migrating. */
  dryRun?: boolean
  /** Skip the post-sync hooks (auto-imports / migrate / bun install). */
  noPostinstall?: boolean
  /** Run post-sync hooks (default true). Inverse of --no-postinstall. */
  postinstall?: boolean
}

const options = parseOptions() as UpgradeOptions

const projectRoot = p.projectPath()

// Node-modules app model: there is no vendored `storage/framework/core` to
// sync framework source into. Such an app upgrades by bumping its published
// `stacks` + `@stacksjs/*` dependency versions and reinstalling. Branch here,
// before any vendored-core paths are read.
if (!existsSync(p.projectPath('storage/framework/core'))) {
  const { upgradeStacksPackages } = await import('./packages')
  await upgradeStacksPackages(projectRoot, {
    version: options.version,
    canary: options.canary,
    stable: options.stable,
    force: options.force,
    dryRun: options.dryRun,
    noPostinstall: options.noPostinstall ?? options.postinstall === false,
  })
}

const channelFile = join(projectRoot, '.stacks-channel')
const versionFile = join(projectRoot, '.stacks-version')
const currentChannel = readChannel(channelFile)
const ctx = resolveUpgradeContext(options, currentChannel)

const corePkgPath = p.projectPath('storage/framework/core/buddy/package.json')
const currentVersion = readVersion(corePkgPath)

// Source resolution. Explicit `--from` wins. Otherwise auto-detect a sibling
// stacks checkout for instant offline updates. If neither is available,
// fall back to gitit (GitHub).
const explicitLocal = options.from ? p.projectPath(options.from) : null
const detectedLocal = explicitLocal ?? (shouldAutoDetectLocalStacks(options) ? detectLocalStacks(projectRoot) : null)
const usingLocal = !!detectedLocal

// User-facing status output. We use `console.log` directly (not the
// `@stacksjs/logging` facade) because the facade's writes are async — and
// this script ends with `process.exit`, which fires before async writes
// flush. The result was a silent script that looked like it did nothing.
console.log(resolveUpgradeMessage(ctx, currentChannel, !!options.stable))
console.log(usingLocal
  ? `  source: local checkout at ${detectedLocal}`
  : `  source: github:stacksjs/stacks#${ctx.ref}`)

// --dry-run: full preview, zero side effects. The "after" state of every
// managed path is snapshotted from the upgrade SOURCE (the local checkout
// for --from, or a temp-dir download outside the project for GitHub), so we
// can list exactly what a real run would change without writing a single
// byte into the project, installing dependencies, or running migrations.
if (options.dryRun) {
  await runDryRunPreview()
  process.exit(ExitCode.Success)
}

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

// Already-up-to-date short-circuit. We compare the resolved channel's remote
// branch HEAD sha against the sha persisted at the last successful sync
// (.stacks-version). If they match — same channel, same commit — there's
// nothing to do, so we skip the entire download + re-exec + hooks pipeline.
//
// Skipped for --force (explicit re-sync) and --version pins (explicit tag
// intent — always install the pinned tag). Fails OPEN: if the remote sha can't
// be read (offline, no git), we fall through and let the (cache-preferring)
// sync run rather than block the update on a network blip. Stashed in an outer
// binding so we can record it post-sync without a second ls-remote.
let resolvedRemoteSha: string | null = null
if (!options.force && !ctx.targetVersion) {
  resolvedRemoteSha = await getRemoteSha(ctx, usingLocal, detectedLocal)
  const synced = readSyncedVersion(versionFile)
  if (shouldShortCircuit({ force: !!options.force, targetVersion: ctx.targetVersion, remoteSha: resolvedRemoteSha, synced, channel: ctx.channel })) {
    console.log(`✔ Already on the latest ${ctx.channel} (${resolvedRemoteSha!.slice(0, 7)}).`)
    process.exit(ExitCode.Success)
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
    cmd: [process.argv[0] || 'bun', ownPath, ...args, '--__restarted'],
    cwd: projectRoot,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const code = await proc.exited
  process.exit(code ?? 0)
}

// Persist channel choice (not when pinning a specific version). We also record
// the synced commit sha so the next `buddy update` can short-circuit when
// nothing has moved. This runs only in the FINAL executing instance: when the
// upgrade re-execs (above), the parent exits before reaching here, so the
// re-exec'd child is the one that writes both files exactly once.
//
// The --force path skips the precheck, so `resolvedRemoteSha` may be null here
// — re-fetch once so a forced sync still records a fresh sha.
if (!ctx.targetVersion) {
  writeChannel(channelFile, ctx.channel)
  if (!resolvedRemoteSha)
    resolvedRemoteSha = await getRemoteSha(ctx, usingLocal, detectedLocal)
  if (resolvedRemoteSha)
    writeSyncedVersion(versionFile, ctx.channel, resolvedRemoteSha)
}

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
  try {
    await runPostSyncHooks({ aggregate, perPath, projectRoot })
  }
  catch (err) {
    console.error(`Post-sync hooks failed: ${(err as Error)?.message || err}`)
    process.exit(ExitCode.FatalError)
  }
}

if (ctx.channel === 'canary' && !ctx.targetVersion) {
  console.warn('⚠ Canary builds may contain bugs or breaking changes. Not recommended for production.')
}

process.exit(ExitCode.Success)

// ===========================================================================
// helpers
// ===========================================================================

/**
 * `--dry-run` preview. Reports exactly what a real run would do (per-path
 * file diffs, version change, channel/sha writes, post-sync hooks) while
 * performing no writes itself. Runs entirely against the upgrade source:
 * the local checkout for `--from`, or templates downloaded into a temp dir
 * OUTSIDE the project (removed afterwards) for the GitHub path.
 */
async function runDryRunPreview(): Promise<void> {
  console.log('\n  DRY RUN - preview only. No files will be written, nothing will be installed, no migrations will run.\n')

  // Advisory only: a real run aborts on dirty managed paths unless --force.
  // The preview cannot clobber anything, so warn and keep going.
  const dirty = await detectDirtyManagedPaths(projectRoot)
  if (dirty.length > 0) {
    console.warn('  Note: these framework-managed paths have uncommitted changes (a real run would abort without --force):')
    for (const path of dirty) console.warn(`    - ${path}`)
    console.warn('')
  }

  // Up-to-date check with the same inputs as the real short-circuit.
  let previewSha: string | null = null
  if (!options.force && !ctx.targetVersion) {
    previewSha = await getRemoteSha(ctx, usingLocal, detectedLocal)
    const synced = readSyncedVersion(versionFile)
    if (shouldShortCircuit({ force: !!options.force, targetVersion: ctx.targetVersion, remoteSha: previewSha, synced, channel: ctx.channel })) {
      console.log(`✔ Already on the latest ${ctx.channel} (${previewSha!.slice(0, 7)}). A real run would change nothing.`)
      return
    }
  }

  const aggregate: ChangeSummary = { added: 0, changed: 0, removed: 0, unchanged: 0 }
  const perPath: { managed: ManagedPath, summary: ChangeSummary }[] = []
  let sawRemoved = 0
  let sourceVersion: string | null = null

  const tmpBase = mkdtempSync(join(tmpdir(), 'stacks-upgrade-dry-run-'))
  try {
    let repoTmp: string | null = null

    for (const managed of MANAGED_PATHS) {
      const localTarget = join(projectRoot, managed.localPath)
      const before = managed.isFile
        ? await singleFileSnapshot(localTarget)
        : await snapshotTree(localTarget, managed.skip)

      let after: Map<string, SnapshotEntry>
      if (usingLocal && detectedLocal) {
        const src = join(detectedLocal, managed.subPath)
        if (!existsSync(src)) {
          console.log(`  ${managed.label.padEnd(10)} skip: source missing at ${src}`)
          continue
        }
        after = managed.isFile
          ? await singleFileSnapshot(src)
          : await snapshotTree(src, managed.skip)
      }
      else {
        try {
          if (managed.isFile) {
            // Single files (buddy / bootstrap) come from one whole-repo
            // download, mirroring syncRootFilesFromGitHub.
            if (!repoTmp) {
              repoTmp = join(tmpBase, 'repo')
              await downloadTemplate(`github:stacksjs/stacks#${ctx.ref}`, {
                dir: repoTmp,
                force: true,
                forceClean: true,
                preferOffline: true,
                silent: true,
              })
            }
            after = await singleFileSnapshot(join(repoTmp, managed.subPath))
          }
          else {
            const dir = join(tmpBase, managed.label)
            await downloadTemplate(buildTemplateString(ctx.ref, managed.subPath), {
              dir,
              force: true,
              forceClean: true,
              preferOffline: !options.force,
              silent: true,
            })
            after = await snapshotTree(dir, managed.skip)
          }
        }
        catch (err) {
          console.log(`  ${managed.label.padEnd(10)} preview unavailable (${(err as Error)?.message || err}); a real run would sync from github:stacksjs/stacks#${ctx.ref}`)
          continue
        }
      }

      const summary = diffSnapshotsDetailed(before, after)
      aggregate.added += summary.added
      aggregate.changed += summary.changed
      aggregate.removed += summary.removed
      aggregate.unchanged += summary.unchanged
      perPath.push({ managed, summary })
      sawRemoved += summary.removed

      if (managed.isFile) {
        const moved = summary.added + summary.changed > 0
        console.log(`  ${managed.label.padEnd(10)} ${moved ? 'would update' : 'unchanged'}`)
      }
      else if (summary.added + summary.changed + summary.removed === 0) {
        console.log(`  ${managed.label.padEnd(10)} unchanged (${summary.unchanged} files)`)
      }
      else {
        console.log(`  ${managed.label.padEnd(10)} +${summary.added} ~${summary.changed} -${summary.removed} (${summary.unchanged} unchanged)`)
        const samples = [
          ...summary.addedFiles.map(f => `+ ${f}`),
          ...summary.changedFiles.map(f => `~ ${f}`),
        ]
        for (const line of samples.slice(0, 8)) console.log(`      ${line}`)
        if (samples.length > 8)
          console.log(`      ... and ${samples.length - 8} more`)
      }
    }

    // Version the sync would land on, read from the source rather than from a
    // post-sync tree.
    const sourcePkgPath = usingLocal && detectedLocal
      ? join(detectedLocal, 'storage/framework/core/buddy/package.json')
      : repoTmp
        ? join(repoTmp, 'storage/framework/core/buddy/package.json')
        : join(tmpBase, 'core', 'buddy', 'package.json')
    sourceVersion = readVersion(sourcePkgPath)
  }
  finally {
    rmSync(tmpBase, { recursive: true, force: true })
  }

  console.log('')
  if (currentVersion || sourceVersion) {
    console.log(currentVersion === sourceVersion
      ? `  version: unchanged (v${currentVersion ?? 'unknown'})`
      : `  version: v${currentVersion ?? 'unknown'} -> v${sourceVersion ?? 'unknown'}`)
  }

  console.log('\n  A real run would:')
  console.log('    - sync the managed paths above into place')
  if (!ctx.targetVersion) {
    console.log(`    - write channel "${ctx.channel}" to .stacks-channel`)
    console.log(previewSha
      ? `    - record synced sha ${previewSha.slice(0, 7)} in .stacks-version`
      : '    - record the resolved commit sha in .stacks-version (unavailable in this preview)')
  }

  const runHooks = !options.noPostinstall && options.postinstall !== false
  if (!runHooks) {
    console.log('    - skip post-sync hooks (--no-postinstall)')
  }
  else if (aggregate.added + aggregate.changed + aggregate.removed === 0) {
    console.log('    - skip post-sync hooks (nothing changed)')
  }
  else {
    console.log('    - regenerate the auto-import manifest')
    const corePkgChanged = perPath.some((entry) => {
      const { managed, summary } = entry
      if (managed.isFile) return false
      if (managed.label !== 'core' && managed.label !== 'defaults') return false
      if (summary.added + summary.changed === 0) return false
      return pkgJsonInTree(join(projectRoot, managed.localPath))
    })
    if (corePkgChanged)
      console.log('    - run `bun install` to refresh dependencies')
    if (existsSync(join(projectRoot, 'database', 'migrations')))
      console.log('    - run pending migrations')
  }

  if (sawRemoved > 0)
    console.log('\n  (-N counts files no longer shipped upstream; the sync leaves them in place.)')

  console.log('\n✔ Dry run complete. No changes were made.')
}

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

/**
 * Resolve the commit sha of the channel's branch HEAD for the up-to-date
 * short-circuit. For a local checkout we `git rev-parse <ref>` in that repo
 * (falling back to HEAD if the named branch doesn't exist locally). For the
 * GitHub path we `git ls-remote` for `refs/heads/<ref>`. Fails OPEN: any
 * failure (no git, offline, unknown ref) returns null so the caller proceeds
 * with the sync rather than blocking on a network blip.
 */
async function getRemoteSha(context: UpgradeContext, fromLocal: boolean, stacksRoot: string | null): Promise<string | null> {
  const SHA_RE = /^[0-9a-f]{40}$/i
  try {
    if (fromLocal && stacksRoot) {
      const proc = Bun.spawn({
        cmd: ['git', '-C', stacksRoot, 'rev-parse', context.ref],
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const out = (await new Response(proc.stdout).text()).trim()
      if ((await proc.exited) === 0 && SHA_RE.test(out))
        return out.toLowerCase()

      // Named ref absent in the checkout — fall back to its current HEAD.
      const head = Bun.spawn({
        cmd: ['git', '-C', stacksRoot, 'rev-parse', 'HEAD'],
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const h = (await new Response(head.stdout).text()).trim()
      return (await head.exited) === 0 && SHA_RE.test(h) ? h.toLowerCase() : null
    }

    // GitHub: ls-remote prints "<sha>\trefs/heads/<ref>" lines.
    const proc = Bun.spawn({
      cmd: ['git', 'ls-remote', 'https://github.com/stacksjs/stacks.git', `refs/heads/${context.ref}`],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const out = await new Response(proc.stdout).text()
    if ((await proc.exited) !== 0)
      return null
    const m = out.match(/^([0-9a-f]{40})\s/i)
    return m?.[1] ? m[1].toLowerCase() : null
  }
  catch {
    // git missing or other failure — fail open to sync.
    return null
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
    if (managed.executable) chmodSync(localTarget, 0o755)
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
        if (existsSync(src) && existsSync(dest)) {
          copyFileSync(src, dest)
          if (managed.executable) chmodSync(dest, 0o755)
        }
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
        cmd: [process.argv[0] || 'bun', 'install'],
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
    const migrateScript = p.frameworkPath('core/buddy/src/cli.ts')
    await runPostSyncMigration({
      bunExecutable: process.argv[0] || 'bun',
      migrateScript,
      projectRoot,
      spawn: spawnOptions => Bun.spawn(spawnOptions),
    })
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
