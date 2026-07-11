#!/usr/bin/env bun
import { execSync, log, parseOptions } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { versionBump } from '@stacksjs/bumpx'
import { generateChangelog, loadLogsmithConfig } from '@stacksjs/logsmith'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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

async function git(args: string[], cwd = p.projectPath()): Promise<string> {
  return await execSync(['git', ...args], {
    cwd,
    stdin: 'inherit',
  })
}

async function readVersion(file: string): Promise<string> {
  const pkg = await readPackage(file)

  if (!pkg?.version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version))
    throw new Error(`Invalid version in ${file}: ${pkg?.version ?? '<missing>'}`)

  return pkg.version
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
const latestTag = (await git(['describe', '--abbrev=0', '--tags']).catch(() => '')).trim()

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

// Pin the `stacks` meta package's lockstep core dependencies to the freshly
// bumped version. bumpx only rewrites each manifest's `version`, leaving the
// meta's `@stacksjs/*` ranges frozen at whatever floor they were last written
// with (e.g. `^0.70.53`). That floor lets a consumer's stale lockfile keep old
// framework versions forever — `stacks@X` would happily resolve `@stacksjs/*`
// to a much older release. Re-pinning to `^<nextVersion>` makes a published
// `stacks@X` deterministically require the matching core versions, so a plain
// `bun install` upgrades the whole framework. Only lockstep core packages (a
// sibling dir under core/ that bumpx just moved to nextVersion) are pinned;
// independently-versioned scoped deps (tlsx, dnsx, gitit, …) are left alone.
// Consumer-app releases have no meta to pin, so this is framework-only.
if (!isDryRun && isFrameworkRelease)
  pinMetaCoreDeps(nextVersion)

function pinMetaCoreDeps(version: string): void {
  const metaPath = p.frameworkPath('core/package.json')
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  let pinned = 0
  for (const field of ['dependencies', 'devDependencies'] as const) {
    const deps = meta[field]
    if (!deps)
      continue

    for (const name of Object.keys(deps)) {
      if (!name.startsWith('@stacksjs/'))
        continue

      const dir = name.slice('@stacksjs/'.length)
      const localPkgPath = p.frameworkPath(`core/${dir}/package.json`)
      if (!existsSync(localPkgPath))
        continue

      // Only pin packages the bump just moved to this version (true lockstep
      // core packages); an external scoped dep vendored elsewhere won't match.
      const localVersion = (JSON.parse(readFileSync(localPkgPath, 'utf-8')) as { version?: string }).version
      if (localVersion !== version)
        continue

      const next = `^${version}`
      if (deps[name] !== next) {
        deps[name] = next
        pinned++
      }
    }
  }

  if (pinned > 0) {
    writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
    log.debug(`Pinned ${pinned} lockstep core dep(s) in the stacks meta to ^${version}`)
  }
}

if (!isDryRun) {
  await git(['add', '--all'])
  await git(['commit', '-m', `chore: release v${nextVersion}`])
  await git(['tag', `v${nextVersion}`])
  await git(['push'])
  await git(['push', 'origin', `v${nextVersion}`])
}
