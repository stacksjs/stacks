#!/usr/bin/env bun
import { execSync, log, parseOptions } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { versionBump } from '@stacksjs/bumpx'
import { generateChangelog, loadLogsmithConfig } from '@stacksjs/logsmith'
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const options = parseOptions() as { dryRun?: boolean, bump?: string, verbose?: boolean } | undefined

// Accept --bump patch|minor|major|<explicit-version>; without it, bumpx prompts
// interactively. The `release:patch` / `release:minor` / `release:major` npm
// shortcuts at the project root pipe through to here non-interactively.
const allowedBumps = new Set(['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease'])
const rawBump = options?.bump?.toString()
const bumpArg = rawBump
  ? (allowedBumps.has(rawBump) || /^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(rawBump) ? rawBump : null)
  : null
if (rawBump && !bumpArg)
  log.warn(`Ignoring invalid --bump "${rawBump}"; expected one of patch|minor|major or x.y.z`)

const isDryRun = options?.dryRun === true
const isVerbose = (options as { verbose?: boolean })?.verbose === true

// ── Framework-monorepo vs consumer-app release ──────────────────────────────
// `buddy release` serves two very different jobs:
//   • In the stacks framework repo it bumps every publishable core package and
//     re-pins the `stacks` meta, then tags the framework.
//   • In a consumer app it bumps that app's OWN root package.json and tags it.
// The distinguishing signal is the *root* package name — only the framework
// repo's root is `stacks`. Keying on that (rather than the presence of
// `storage/framework/core`) keeps this correct for a consumer app whether it
// vendors the framework under `storage/framework` or pulls it from
// `node_modules` — a vendored framework copy is never what a consumer releases.
async function readPackage(file: string): Promise<{ name?: string, version?: string } | undefined> {
  if (!existsSync(file))
    return undefined
  return await Bun.file(file).json() as { name?: string, version?: string }
}

const rootManifest = p.projectPath('package.json')
const rootPkg = await readPackage(rootManifest)
const isFrameworkRelease = rootPkg?.name === 'stacks' && existsSync(p.frameworkPath('core/package.json'))

// The cwd bumpx runs in, and the manifest we read the resulting version from.
const bumpCwd = isFrameworkRelease ? p.frameworkPath('core') : p.projectPath()
const primaryManifest = isFrameworkRelease ? p.frameworkPath('core/package.json') : rootManifest

async function resolveBumpArg(bump: string | null): Promise<string | null> {
  if (!bump || /^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(bump))
    return bump

  if (!['patch', 'minor', 'major'].includes(bump))
    return bump

  const pkg = await readPackage(primaryManifest)
  const match = pkg?.version?.match(/^(\d+)\.(\d+)\.(\d+)$/)

  if (!match)
    return bump

  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  if (bump === 'major')
    return `${major + 1}.0.0`

  if (bump === 'minor')
    return `${major}.${minor + 1}.0`

  return `${major}.${minor}.${patch + 1}`
}

const resolvedBumpArg = await resolveBumpArg(bumpArg)

/**
 * Run git, and fail loudly when git fails.
 *
 * `execSync` does not read the child's exit code unless asked, so this used to
 * treat a rejected push exactly like a successful one. The commit, tag and both
 * pushes at the end of this file all run through here, which meant a release
 * could be rejected at every single step and still print "Successfully
 * released" with nothing published and a bogus local tag left behind.
 *
 * Callers that legitimately expect failure (the `git describe` probe for the
 * latest tag, which fails on a repo with no tags) pass `throwOnError: false`.
 */
async function git(args: string[], cwd = p.projectPath(), options: { throwOnError?: boolean } = {}): Promise<string> {
  return await execSync(['git', ...args], {
    cwd,
    stdin: 'inherit',
    stderr: 'pipe',
    throwOnError: options.throwOnError ?? true,
  })
}

async function readVersion(file: string): Promise<string> {
  const pkg = await readPackage(file)

  if (!pkg?.version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version))
    throw new Error(`Invalid version in ${file}: ${pkg?.version ?? '<missing>'}`)

  return pkg.version
}

function lockfileVersion(contents: string): number | null {
  const match = contents.match(/"lockfileVersion"\s*:\s*(\d+)/)
  return match ? Number(match[1]) : null
}

// Only the framework release fans the bump out across the publishable core
// packages; a consumer app just bumps its own root manifest.
async function packageFilesFor(pattern: string, cwd: string): Promise<string[]> {
  const glob = new Bun.Glob(pattern)
  const files: string[] = []

  for await (const file of glob.scan({ cwd, absolute: true, onlyFiles: true })) {
    if (file.includes('/node_modules/') || file.includes('/dist/') || file.includes('/pantry/'))
      continue

    files.push(`./${relative(bumpCwd, file)}`)
  }

  return files
}

async function existingPackageFiles(files: string[]): Promise<string[]> {
  const existing: string[] = []

  for (const file of files) {
    const absolutePath = join(bumpCwd, file)
    if (await Bun.file(absolutePath).exists())
      existing.push(file)
  }

  return existing
}

async function frameworkBumpFiles(): Promise<string[]> {
  // Build an explicit file list instead of passing globs through to bumpx. The
  // release workflow previously treated a few glob targets as literal paths,
  // leaving publishable core packages at the previous version.
  return Array.from(new Set([
    ...(await packageFilesFor('package.json', bumpCwd)),
    ...(await packageFilesFor('*/package.json', bumpCwd)),
    ...(await packageFilesFor('*/*/package.json', bumpCwd)),
    ...(await existingPackageFiles([
      '../package.json',
      '../defaults/ide/vscode/package.json',
      '../api/package.json',
      '../cloud/package.json',
      '../docs/package.json',
      '../orm/package.json',
      '../server/package.json',
    ])),
    ...(await packageFilesFor('../libs/**/package.json', bumpCwd)),
  ]))
}

const bumpFiles = isFrameworkRelease ? await frameworkBumpFiles() : ['./package.json']

log.debug(`Release mode: ${isFrameworkRelease ? 'framework monorepo' : 'consumer app'} (${rootPkg?.name ?? 'unknown'})`)
log.debug(`Bumping ${bumpFiles.length} package manifest(s) in ${bumpCwd}`)

// Drive bumpx through its SDK instead of spawning `bunx bumpx`. Git is handled
// below (custom commit message + changelog staged first), so bumpx only rewrites
// the version in each manifest: `commit/tag/push` off, `recursive` off (the file
// list is explicit), `changelog` off (logsmith owns that). Passing `release`
// non-interactively implies `yes`; omitting it lets bumpx prompt for the bump.
await versionBump({
  release: resolvedBumpArg ?? undefined,
  files: bumpFiles,
  cwd: bumpCwd,
  recursive: false,
  commit: false,
  tag: false,
  push: false,
  changelog: false,
  // `buddy release` runs LintFix before this, so the tree is intentionally
  // dirty; we stage & commit manually below. Don't let bumpx gate on it.
  noGitCheck: true,
  dryRun: isDryRun,
  yes: Boolean(resolvedBumpArg),
  verbose: isVerbose,
})

// On a dry run bumpx doesn't write the manifest, so trust the resolved arg for
// the next version; otherwise read it back from the freshly bumped manifest.
const nextVersion = isDryRun && resolvedBumpArg && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(resolvedBumpArg)
  ? resolvedBumpArg
  : await readVersion(primaryManifest)

// Generate the changelog through logsmith's SDK (was a `buddy changelog` shell
// call into changelogen). `from` is the latest tag so only this release's
// commits are captured; on a dry run we render to the console instead of writing.
const latestTag = (await git(['describe', '--abbrev=0', '--tags'], p.projectPath(), { throwOnError: false }).catch(() => '')).trim()

async function writeChangelog(): Promise<void> {
  const config = await loadLogsmithConfig({
    dir: p.projectPath(),
    from: latestTag || undefined,
    to: 'HEAD',
    output: isDryRun ? false : 'CHANGELOG.md',
    theme: 'github',
    verbose: isVerbose,
  })

  const result = await generateChangelog(config)

  if (isDryRun) {
    log.info(result.content)
    return
  }

  // logsmith headers the new section off the `from…to` range as
  // `compare/<prev>…HEAD` — it can't know the tag, which doesn't exist yet. Stamp
  // the release version into the committed changelog so the file is
  // self-describing: the tag we're about to push makes `compare/<prev>…v<X>`
  // resolvable, and CI can extract THIS release's notes by tag straight from the
  // committed file — no regeneration needed downstream.
  const changelogPath = p.projectPath('CHANGELOG.md')
  if (!existsSync(changelogPath))
    return

  let content = readFileSync(changelogPath, 'utf-8')
  const versionSeen = new RegExp(`\\bv?${nextVersion.replace(/\./g, '\\.')}\\b`)

  if (/\/compare\/[^)\s]+\.\.\.HEAD\)/.test(content)) {
    // Subsequent release: point the compare link at the new tag.
    content = content.replace(/(\/compare\/[^)\s]+\.\.\.)HEAD(\))/, `$1v${nextVersion}$2`)
  }
  else if (!versionSeen.test(content.split('\n').slice(0, 4).join('\n'))) {
    // First release (no previous tag ⇒ no compare link): give the top section a
    // version heading, inserted after an optional leading `# Changelog` title.
    content = content.replace(/^(#\s.*\n+)?/, match => `${match ?? ''}## v${nextVersion}\n\n`)
  }

  writeFileSync(changelogPath, content)
}

await writeChangelog()

// Pin every core package's lockstep dependencies to the freshly bumped
// version. bumpx only rewrites each manifest's `version`, leaving `@stacksjs/*`
// ranges frozen at whatever floor they were last written with (e.g.
// `^0.70.53`). That floor lets a consumer's stale lockfile keep old framework
// versions forever — `stacks@X` would happily resolve `@stacksjs/*` to a much
// older release. Re-pinning to `^<nextVersion>` makes a published package
// deterministically require the matching core versions, so a plain `bun
// install` upgrades the whole framework together.
//
// This covers every core manifest, not just the `stacks` meta. A floor left in
// `@stacksjs/buddy` is the same bug one level down: buddy@0.70.234 asking for
// `@stacksjs/actions: ^0.70.180` lets a resolver nest a much older actions
// under it, and buddy's commands then fail to import symbols its own release
// added — the CLI drops the whole command group with nothing but "command not
// found" to go on.
//
// Only true lockstep packages are pinned: a sibling dir under core/ that
// publishes under that name and that bumpx just moved to nextVersion.
// Independently-versioned scoped deps (tlsx, dnsx, gitit, clapp, …) and
// `workspace:*` links are left alone.
if (!isDryRun && isFrameworkRelease)
  pinLockstepDeps(nextVersion)

async function refreshPantryLock(): Promise<void> {
  const lockPath = p.projectPath('pantry.lock')
  if (!existsSync(lockPath))
    return

  const previousLock = readFileSync(lockPath)
  try {
    await execSync(['pantry', 'install', '--ignore-scripts', '--quiet'], {
      cwd: p.projectPath(),
      stdin: 'inherit',
    })
    if (!existsSync(lockPath))
      throw new Error('Pantry completed without writing pantry.lock')
  }
  catch (error) {
    writeFileSync(lockPath, previousLock)
    throw new Error(
      'Release aborted: Pantry could not refresh pantry.lock without lifecycle scripts. The previous lockfile was restored.',
      { cause: error },
    )
  }
}

if (!isDryRun)
  await refreshPantryLock()

// The package-version fan-out above changes hundreds of workspace manifests.
// Keep the root Bun lockfile synchronized in the same release commit; otherwise
// every post-release CI job using `bun install --frozen-lockfile` fails before
// lint, typecheck, or tests can run.
if (!isDryRun && existsSync(p.projectPath('bun.lock'))) {
  const lockPath = p.projectPath('bun.lock')
  const previousLock = readFileSync(lockPath)

  // Bun updates package resolutions in place, but it does not rewrite stale
  // workspace manifest snapshots after the release changes lockstep ranges.
  // Regenerate the canonical lockfile so frozen installs see the same workspace
  // state as the manifests. Restore the previous lock if resolution fails.
  unlinkSync(lockPath)
  try {
    await execSync(['bun', 'install', '--lockfile-only'], {
      cwd: p.projectPath(),
      stdin: 'inherit',
    })
  }
  catch (error) {
    writeFileSync(lockPath, previousLock)
    throw error
  }

  // A release must preserve the canonical lockfile format already committed by
  // the repository. Derive it from that file instead of duplicating the Bun to
  // lockfile-version mapping here: Pantry and engines.bun own the toolchain, and
  // .github/scripts/check-lockfile-version.ts verifies the checked-in format.
  // A different local Bun would otherwise write a lockfile CI cannot consume.
  /*
   * A lockfile that was not written back is not a lockfile to read.
   *
   * `bun install --lockfile-only` exits zero when it cannot resolve - which is
   * what happens the moment this bump raises an external range to a version its
   * own repository has not published yet - and simply writes nothing. The read
   * below then threw ENOENT *outside* the restore above, so the release aborted
   * having deleted the repository's lockfile and put nothing in its place.
   *
   * Restore first, then say which it was.
   */
  if (!existsSync(lockPath)) {
    writeFileSync(lockPath, previousLock)
    throw new Error(
      'Release aborted: `bun install --lockfile-only` wrote no lockfile, so the previous one has been restored. '
      + 'This usually means a dependency range this bump just raised names a version that is not published yet - '
      + 'release that package first, then re-run.',
    )
  }

  const expectedLockfileVersion = lockfileVersion(previousLock.toString('utf8'))
  const regeneratedLock = readFileSync(lockPath, 'utf8')
  const producedVersion = lockfileVersion(regeneratedLock)
  if (expectedLockfileVersion == null || producedVersion !== expectedLockfileVersion) {
    writeFileSync(lockPath, previousLock)
    throw new Error(
      `Release aborted: regenerating bun.lock produced lockfileVersion ${producedVersion ?? 'unknown'}, `
      + `but the repository requires v${expectedLockfileVersion ?? 'unknown'}. Re-run the release with the `
      + `repository's declared Bun toolchain through \`pantry install\`, then regenerate and commit the canonical lockfile.`,
    )
  }
}

/**
 * Index the core packages by the name they publish under.
 *
 * Keyed by name rather than directory: a directory under core/ does not have
 * to publish under its own name. `core/desktop` is `@stacksjs/desktop-build`,
 * while `@stacksjs/desktop` is the separately-released stx desktop API frozen
 * at whatever it last shipped. Matching on the directory pinned that external
 * package to a framework version that would never exist, `bun install
 * --lockfile-only` then failed to resolve it, and the release threw before it
 * could commit or tag — which is why v0.70.233 is a bump commit with no tag.
 */
function lockstepPackages(version: string): Set<string> {
  const names = new Set<string>()

  for (const entry of readdirSync(p.frameworkPath('core'), { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue

    const manifest = p.frameworkPath(`core/${entry.name}/package.json`)
    if (!existsSync(manifest))
      continue

    const pkg = JSON.parse(readFileSync(manifest, 'utf-8')) as { name?: string, version?: string }

    // Only packages the bump just moved to this version are lockstep; an
    // independently-versioned scoped dep vendored under core/ will not match.
    if (pkg.name?.startsWith('@stacksjs/') && pkg.version === version)
      names.add(pkg.name)
  }

  return names
}

function pinLockstepDeps(version: string): void {
  const lockstep = lockstepPackages(version)
  const next = `^${version}`

  const manifests = [
    p.frameworkPath('core/package.json'),
    ...readdirSync(p.frameworkPath('core'), { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => p.frameworkPath(`core/${entry.name}/package.json`))
      .filter(path => existsSync(path)),
  ]

  let pinned = 0
  for (const manifestPath of manifests) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    let changed = false
    for (const field of ['dependencies', 'devDependencies'] as const) {
      const deps = manifest[field]
      if (!deps)
        continue

      for (const name of Object.keys(deps)) {
        // `workspace:*` already resolves to the sibling and is rewritten to a
        // concrete version at publish time; overwriting it would break the
        // local link for no gain.
        if (!lockstep.has(name) || deps[name]!.startsWith('workspace:') || deps[name] === next)
          continue

        deps[name] = next
        changed = true
        pinned++
      }
    }

    if (changed)
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }

  if (pinned > 0)
    log.debug(`Pinned ${pinned} lockstep core dep(s) to ^${version}`)
}

/**
 * Stage only what a release owns: the manifests the bump rewrote, the
 * changelog it generated, and the lockfile it refreshed.
 *
 * This used to be `git add --all`, which quietly made every release a commit of
 * whatever happened to be in the tree. A release is usually cut with something
 * else half-finished next to it — another branch's worth of edits, a colleague's
 * session, a scratch script — and all of it went out under `chore: release vX`,
 * tagged, pushed, and built by CI. For a repo that publishes to app stores off
 * that tag, that is unreviewed work shipping to users.
 *
 * Whatever is left dirty is reported rather than swept, so the release stays
 * the release and the rest stays yours.
 */
async function stageReleaseArtifacts(): Promise<void> {
  // Staged by pathspec rather than by parsing `git status`: porcelain quotes
  // any path containing a space or a non-ASCII byte, and feeding that back to
  // `git add` stages a filename with literal quotes in it. Let git do the
  // matching. Unmodified matches are a no-op, but a pathspec matching nothing
  // at all is fatal, so every optional one is guarded.
  //
  // The vendored core manifests belong to a framework release only. A consumer
  // app either has no `storage/framework` at all or has one with no manifests
  // in it, and the unguarded glob made `git add` exit 128 — aborting *every*
  // consumer release right here, after the bump had already rewritten
  // package.json, CHANGELOG.md and bun.lock. A repository-wide
  // `**/package.json` is not the alternative: it also matches package-manager
  // scratch directories (an interrupted `node_modules.partial` install, say),
  // which would smuggle generated dependency manifests into the tag.
  const pathspecs = isFrameworkRelease
    ? [':(glob)storage/framework/**/package.json', 'package.json']
    : ['package.json']
  for (const file of ['CHANGELOG.md', 'bun.lock', 'pantry.lock']) {
    if (existsSync(p.projectPath(file)))
      pathspecs.push(file)
  }

  await git(['add', '--', ...pathspecs])

  // Report, don't sweep. Anything still dirty is someone's work in progress,
  // and it is better for them to see it named than to find it in a release.
  const leftover = (await git(['status', '--porcelain']))
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line && !line.startsWith('A ') && !line.startsWith('M '))

  if (leftover.length) {
    log.warn(
      `Kept ${leftover.length} change(s) out of the release commit:\n  ${leftover.slice(0, 20).join('\n  ')}`
      + `${leftover.length > 20 ? `\n  … and ${leftover.length - 20} more` : ''}`,
    )
  }
}

if (!isDryRun) {
  await stageReleaseArtifacts()
  await git(['commit', '-m', `chore: release v${nextVersion}`])
  await git(['tag', `v${nextVersion}`])
  await git(['push'])
  await git(['push', 'origin', `v${nextVersion}`])
}
