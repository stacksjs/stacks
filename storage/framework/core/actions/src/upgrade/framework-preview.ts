import type { UpgradeOptions } from '@stacksjs/types'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { downloadTemplate } from '@stacksjs/gitit'
import {
  buildTemplateString,
  detectLocalStacks,
  diffSnapshotsDetailed,
  MANAGED_PATHS,
  readChannel,
  readSyncedVersion,
  readVersion,
  resolveLatestStableTag,
  resolveUpgradeContext,
  resolveUpgradeMessage,
  shouldAutoDetectLocalStacks,
  shouldShortCircuit,
  snapshotTree,
  type ChangeSummary,
  type ManagedPath,
  type SnapshotEntry,
  type UpgradeContext,
} from './framework-utils'
import { detectDependencyInstaller, shouldRefreshPostSyncDependencies } from './framework-hooks'
import { detectProjectAiProviders } from './package-project'

// This reusable preview never executes project action bodies, installation,
// compilation, or hooks. Remote inspection retains the native owned temporary
// template staging below, always removed in finally; user destinations are read-only.
export async function resolveFrameworkUpgrade(projectRoot: string, options: UpgradeOptions) {
  const channelFile = join(projectRoot, '.stacks-channel')
  const versionFile = join(projectRoot, '.stacks-version')
  const currentChannel = readChannel(channelFile)

  const corePkgPath = join(projectRoot, 'storage/framework/core/buddy/package.json')
  const currentVersion = readVersion(corePkgPath)

  // Source resolution. Explicit `--from` wins. Otherwise auto-detect a sibling
  // stacks checkout for instant offline updates. If neither is available,
  // fall back to gitit (GitHub).
  const explicitLocal = options.from ? resolve(projectRoot, options.from) : null
  const detectedLocal = explicitLocal ?? (shouldAutoDetectLocalStacks(options) ? detectLocalStacks(projectRoot) : null)
  const usingLocal = !!detectedLocal

  // The stable channel installs the latest published `vX.Y.Z` tag (there is no
  // `stable` branch — releases are cut as tags). Only resolve it when the run
  // will actually land on stable: a pinned `--version` and the canary channel
  // don't need it. A selected local source also needs no remote tag lookup.
  // If the remote tags can't be
  // listed (offline / no git), fall back to the currently-installed version tag
  // so we never target a non-existent ref.
  const willResolveStable = !usingLocal && !options.version && !options.canary && (!!options.stable || currentChannel !== 'canary')
  let latestStableRef = currentVersion ? `v${currentVersion}` : 'main'
  if (willResolveStable) {
    latestStableRef = (await resolveLatestStableTag()) ?? latestStableRef
  }

  const ctx = resolveUpgradeContext(options, currentChannel, latestStableRef)

  // User-facing status output. We use `console.log` directly (not the
  // `@stacksjs/logging` facade) because the facade's writes are async — and
  // this script ends with `process.exit`, which fires before async writes
  // flush. The result was a silent script that looked like it did nothing.
  console.log(resolveUpgradeMessage(ctx, currentChannel, !!options.stable))
  console.log(usingLocal
    ? `  source: local checkout at ${detectedLocal}`
    : `  source: github:stacksjs/stacks#${ctx.ref}`)

  return { channelFile, versionFile, currentChannel, corePkgPath, currentVersion, detectedLocal, usingLocal, ctx }
}

/**
 * `--dry-run` preview. Reports exactly what a real run would do (per-path
 * file diffs, version change, channel/sha writes, post-sync hooks) while
 * performing no writes itself. Runs entirely against the upgrade source:
 * the local checkout for `--from`, or templates downloaded into a temp dir
 * OUTSIDE the project (removed afterwards) for the GitHub path.
 */
export async function previewFrameworkUpgrade(
  projectRoot: string,
  options: UpgradeOptions,
  resolved?: Awaited<ReturnType<typeof resolveFrameworkUpgrade>>,
): Promise<void> {
  const { versionFile, currentVersion, detectedLocal, usingLocal, ctx } = resolved ?? await resolveFrameworkUpgrade(projectRoot, options)
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
  else if (aggregate.added + aggregate.changed + aggregate.removed === 0 && !options.force) {
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
    if (shouldRefreshPostSyncDependencies(corePkgChanged, !!options.force)) {
      const installer = detectDependencyInstaller(existsSync(join(projectRoot, 'pantry.lock')))
      console.log(`    - run \`${installer} install --force\` to refresh dependencies`)
    }
    if (existsSync(join(projectRoot, 'database', 'types.d.ts')))
      console.log('    - regenerate database/types.d.ts')
    if (existsSync(join(projectRoot, 'database', 'migrations')))
      console.log('    - run pending migrations')
    console.log(`    - refresh AI setup for ${detectProjectAiProviders(projectRoot).join(', ')} (including bundled skills)`)
  }

  if (sawRemoved > 0)
    console.log('\n  (-N counts files no longer shipped upstream; the sync leaves them in place.)')

  console.log('\n✔ Dry run complete. No changes were made.')
}

export async function detectDirtyManagedPaths(root: string): Promise<string[]> {
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
export async function getRemoteSha(context: UpgradeContext, fromLocal: boolean, stacksRoot: string | null): Promise<string | null> {
  const SHA_RE = /^[0-9a-f]{40}$/i
  try {
    if (fromLocal && stacksRoot) {
      // syncFromLocal copies the selected working checkout, so freshness
      // follows its HEAD rather than an older installed tag it may contain.
      const head = Bun.spawn({
        cmd: ['git', '-C', stacksRoot, 'rev-parse', 'HEAD'],
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const h = (await new Response(head.stdout).text()).trim()
      return (await head.exited) === 0 && SHA_RE.test(h) ? h.toLowerCase() : null
    }

    // GitHub: ls-remote prints "<sha>\t<ref>" lines. The ref can be a branch
    // (canary → refs/heads/main) or a tag (stable → refs/tags/vX.Y.Z), so we
    // ask for both. For an annotated tag, git also emits a `refs/tags/…^{}`
    // line carrying the dereferenced *commit* sha — prefer it so the short-
    // circuit compares like-for-like against the synced commit.
    const proc = Bun.spawn({
      cmd: [
        'git',
        'ls-remote',
        'https://github.com/stacksjs/stacks.git',
        `refs/heads/${context.ref}`,
        `refs/tags/${context.ref}`,
        `refs/tags/${context.ref}^{}`,
      ],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const out = await new Response(proc.stdout).text()
    if ((await proc.exited) !== 0)
      return null

    const lines = out.split('\n').filter(Boolean)
    const deref = lines.find(l => l.includes('^{}'))
    const chosen = deref ?? lines[0]
    const m = chosen?.match(/^([0-9a-f]{40})\s/i)
    return m?.[1] ? m[1].toLowerCase() : null
  }
  catch {
    // git missing or other failure — fail open to sync.
    return null
  }
}

export async function singleFileSnapshot(absPath: string): Promise<Map<string, SnapshotEntry>> {
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

export function pkgJsonInTree(dir: string): boolean {
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
