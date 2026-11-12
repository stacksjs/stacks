// This file is a script entry. We use `console.log` / `console.warn`
// deliberately (the script ends with `process.exit`, which fires before
// `@stacksjs/logging`'s async writes flush) and rely on top-level await
// to drive the sync pipeline.
/* eslint-disable no-console, ts/no-top-level-await */
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
import { downloadTemplate } from '@stacksjs/gitit'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import {
  buildTemplateString,
  diffSnapshots,
  MANAGED_PATHS,
  readSyncedVersion,
  readVersion,
  resolveSuccessMessage,
  shouldCheckDirtyManagedPaths,
  shouldShortCircuit,
  snapshotTree,
  writeChannel,
  writeSyncedVersion,
  type ChangeSummary,
  type ManagedPath,
} from './framework-utils'
import {
  detectDependencyInstaller,
  resolveDependencyRefreshCommand,
  resolvePantryExecutable,
  runPostSyncAiRefresh,
  runPostSyncDatabaseTypesRefresh,
  runPostSyncDependencyRefresh,
  runPostSyncMigration,
  shouldRefreshPostSyncDependencies,
  shouldRunPostSyncHooks,
} from './framework-hooks'
import { detectDirtyManagedPaths, getRemoteSha, pkgJsonInTree, previewFrameworkUpgrade, resolveFrameworkUpgrade, singleFileSnapshot } from './framework-preview'
import { describeDanglingRouteActions, findDanglingRouteActions, pruneRetiredScaffoldRoutes } from './route-actions'

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
  /** Accept a release that moves an app dependency backwards (#3011). */
  allowDowngrade?: boolean
}

const options = parseOptions() as UpgradeOptions
const alreadyRestarted = process.argv.includes('--__restarted')

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
    allowDowngrade: options.allowDowngrade,
    restarted: alreadyRestarted,
    changedBeforeRestart: process.argv.includes('--__upgrade-changed'),
  })
  process.exit(ExitCode.Success)
}

const resolved = await resolveFrameworkUpgrade(projectRoot, options)
const { channelFile, versionFile, currentChannel, corePkgPath, currentVersion, detectedLocal, usingLocal, ctx } = resolved

// --dry-run: full preview, zero side effects. The "after" state of every
// managed path is snapshotted from the upgrade SOURCE (the local checkout
// for --from, or a temp-dir download outside the project for GitHub), so we
// can list exactly what a real run would change without writing a single
// byte into the project, installing dependencies, or running migrations.
if (options.dryRun) {
  await previewFrameworkUpgrade(projectRoot, options, resolved)
  process.exit(ExitCode.Success)
}

// Pre-flight: warn (and abort, unless --force) if any managed path has
// uncommitted git changes. We don't want `update` to silently overwrite
// hand edits inside framework code. The internal restart skips this duplicate
// check because its parent already validated the tree before intentionally
// syncing these managed paths.
if (shouldCheckDirtyManagedPaths({ force: !!options.force, alreadyRestarted })) {
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
if (ownHashBefore !== 0n && ownHashAfter !== 0n && ownHashBefore !== ownHashAfter && !alreadyRestarted) {
  console.log('Upgrade pulled a newer version of the upgrade action - re-running once to pick up new sync paths and hooks.\n')
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

// Scaffold routes whose action this release removed, and any other route that
// names a missing action. Same step as the package path (see ./route-actions).
{
  const pruned = pruneRetiredScaffoldRoutes(projectRoot)
  for (const route of pruned)
    console.log(`Removed ${route.file}:${route.line}, the scaffold route to ${route.action}: removed in ${route.removedIn}, ${route.reason}`)
  const dangling = findDanglingRouteActions(projectRoot)
  if (dangling.length > 0) {
    console.warn(`${dangling.length} route(s) name an action this version does not ship. Point them at an action that exists, or delete them:`)
    for (const line of describeDanglingRouteActions(dangling).split('\n'))
      console.warn(`  ${line}`)
  }
}

// Post-sync hooks. Run by default — the whole point of `buddy update` being
// dead simple is that the user shouldn't have to chase follow-up commands.
const runHooks = !options.noPostinstall && options.postinstall !== false
if (runHooks) {
  try {
    await runPostSyncHooks({ aggregate, perPath, projectRoot, alreadyRestarted: alreadyRestarted || !!options.force })
  }
  catch (err) {
    console.error(`Post-sync hooks failed: ${(err as Error)?.message || err}`)
    process.exit(ExitCode.FatalError)
  }
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

if (ctx.channel === 'canary' && !ctx.targetVersion) {
  console.warn('⚠ Canary builds may contain bugs or breaking changes. Not recommended for production.')
}

process.exit(ExitCode.Success)

// ===========================================================================
// helpers
// ===========================================================================

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
  // The download has no filter, so a top-level entry `skip` names that the
  // repository also ships - the app's own generated `server-auto-imports.d.ts`
  // under types/ - would be overwritten with the framework's copy. Put those
  // back afterwards, the way the local sync never touches them.
  const kept = new Map<string, Buffer>()
  for (const name of managed.skip ?? []) {
    const file = join(localTarget, name)
    try {
      if (existsSync(file) && statSync(file).isFile())
        kept.set(file, readFileSync(file))
    }
    catch { /* unreadable; the download decides */ }
  }

  const template = buildTemplateString(ref, managed.subPath)
  await downloadTemplate(template, {
    dir: localTarget,
    force: true,
    forceClean: false,
    preferOffline: !force,
  })

  for (const [file, contents] of kept)
    writeFileSync(file, contents)
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
  alreadyRestarted: boolean
}): Promise<void> {
  const { aggregate, perPath, projectRoot, alreadyRestarted } = args

  const changeCount = aggregate.added + aggregate.changed + aggregate.removed
  if (!shouldRunPostSyncHooks(changeCount, alreadyRestarted)) {
    console.log('Nothing changed - skipping post-sync hooks.')
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

  // 2) Reinstall if any synced package.json changed. Updating core/ pulls new
  //    framework package versions; the user's lockfile won't know about them
  //    until install is re-run. We only run install if a package.json moved,
  //    so no-op upgrades stay fast.
  //
  //    Which installer runs matters: a pantry app resolves its packages out of
  //    `pantry/`, so refreshing `node_modules` with Bun would leave the code
  //    that actually gets imported untouched.
  const corePkgChanged = shouldRefreshPostSyncDependencies(perPath.some((entry) => {
    const { managed, summary } = entry
    if (managed.isFile) return false
    if (managed.label !== 'core' && managed.label !== 'defaults') return false
    if (summary.added + summary.changed === 0) return false
    return pkgJsonInTree(join(projectRoot, managed.localPath))
  }), alreadyRestarted)
  if (corePkgChanged) {
    const installer = detectDependencyInstaller(existsSync(join(projectRoot, 'pantry.lock')))
    const cmd = resolveDependencyRefreshCommand({
      installer,
      bunExecutable: process.argv[0] || 'bun',
      pantryExecutable: resolvePantryExecutable(pantryExecutableCandidates(projectRoot), existsSync),
    })

    console.log(`Running \`${installer} install\` to refresh dependencies...`)
    try {
      await runPostSyncDependencyRefresh({
        cmd,
        projectRoot,
        spawn: spawnOptions => Bun.spawn(spawnOptions),
      })
    }
    catch (err) {
      console.warn(`  ${installer} install failed (non-fatal): ${(err as Error)?.message || err}`)
    }
  }

  // 3) Generated table types. `database/types.d.ts` covers the framework's
  //    default models as well as the app's, so a synced `defaults/` can add
  //    columns the committed copy does not know. Non-fatal: the app runs
  //    either way and `buddy generate:db-types` repairs it by hand.
  try {
    const refreshed = await runPostSyncDatabaseTypesRefresh({
      cmd: [process.argv[0] || 'bun', p.frameworkPath('core/buddy/src/cli.ts'), 'generate:db-types'],
      projectRoot,
      spawn: spawnOptions => Bun.spawn(spawnOptions),
      exists: existsSync,
    })
    if (refreshed)
      console.log('Regenerated database/types.d.ts')
  }
  catch (err) {
    console.warn(`  database/types.d.ts was not regenerated (non-fatal): ${(err as Error)?.message || err}`)
  }

  // 4) Run pending migrations. Idempotent — Stacks tracks applied migrations
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

  // The new skill sources alone do not add new Claude links or refresh copied
  // provider files. Use a fresh CLI process against the just-synced defaults.
  console.log('Refreshing AI setup and bundled skills...')
  await runPostSyncAiRefresh({
    cli: [process.argv[0] || 'bun', p.frameworkPath('core/buddy/src/cli.ts')],
    projectRoot,
    spawn: spawnOptions => Bun.spawn(spawnOptions),
  })
}

/**
 * Where a pantry binary might live, most project-local first. Mirrors the
 * lookup `deploy` already does so both paths agree on which pantry runs.
 */
function pantryExecutableCandidates(projectRoot: string): string[] {
  const home = process.env.HOME ?? ''
  return [
    join(projectRoot, 'pantry', '.bin', 'pantry'),
    home ? join(home, '.local', 'bin', 'pantry') : '',
    home ? join(home, '.local', 'share', 'pantry', 'global', 'bin', 'pantry') : '',
  ].filter(Boolean)
}
