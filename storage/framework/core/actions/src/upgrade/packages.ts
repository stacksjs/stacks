// Node-modules app upgrade path. Unlike `framework.ts` (which syncs vendored
// framework *source* into storage/framework/core), an app that consumes the
// published framework from node_modules upgrades by bumping its `stacks` +
// `@stacksjs/*` dependency versions and reinstalling — the "Laravel Shift"
// style framework bump. We deliberately use `console.*` + `process.exit` here
// (same as framework.ts) because the calling script exits synchronously.
/* eslint-disable no-console */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'
import { runCommand } from '@stacksjs/cli'
import {
  detectProjectAiProviders,
  installedDefaultsVersion,
  measureDefaultsDrift,
  migratePackageProjectManifest,
  migratePackageProjectTsconfig,
  summarizeStructureChanges,
  syncPackageProjectFiles,
} from './package-project'

export interface PackageUpgradeOptions {
  /** Pin an exact target version (e.g. 0.70.70). Overrides channel. */
  version?: string
  /** Track the `canary` dist-tag instead of `latest`. */
  canary?: boolean
  /** Track the `latest` (stable) dist-tag. Default. */
  stable?: boolean
  /** Re-write + reinstall even if already at the target version. */
  force?: boolean
  /** Preview the changes without writing package.json or installing. */
  dryRun?: boolean
  /** Skip the post-bump `bun install`. */
  noPostinstall?: boolean
}

export interface PkgJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

export function hasStacksDependency(pkg: PkgJson): boolean {
  return Boolean(pkg.dependencies?.stacks || pkg.devDependencies?.stacks)
}

export function standalonePackageUpdateCommand(): string {
  return 'bun update'
}

/**
 * Refresh the framework through its declared meta-package only.
 *
 * Passing every transitive `@stacksjs/*` name to `bun update` makes Bun promote
 * those packages into the application's direct dependencies. Updating the
 * already-declared `stacks` package refreshes its dependency graph without
 * rewriting the application's ownership boundary.
 */
export function frameworkPackageUpdateCommand(): string {
  return 'bun update stacks'
}

async function updateStandalonePackage(projectRoot: string, options: PackageUpgradeOptions): Promise<never> {
  console.log('\n  Standalone package detected. No Stacks framework source is installed.')

  if (options.dryRun) {
    console.log('  --dry-run: would refresh the package dependencies with `bun update`. No files were changed.\n')
    process.exit(0)
  }

  if (options.noPostinstall) {
    console.log('  --no-postinstall: skipping the dependency refresh. Run `bun update` when ready.\n')
    process.exit(0)
  }

  console.log('  Refreshing declared dependencies...\n')
  const result = await runCommand(standalonePackageUpdateCommand(), { cwd: projectRoot })
  if (result.isErr) {
    console.error('\n✗ The dependency refresh failed. Resolve the reported error and re-run `buddy update`.\n')
    process.exit(1)
  }

  console.log('\n✔ Standalone package dependencies are up to date.\n')
  process.exit(0)
}

/** Resolve the target version + the `stacks` meta's declared dependency ranges. */
async function resolveTarget(options: PackageUpgradeOptions): Promise<{ version: string, metaDeps: Record<string, string> }> {
  const res = await fetch('https://registry.npmjs.org/stacks').catch(() => null)
  if (!res || !res.ok)
    throw new Error('Could not reach the npm registry to resolve the target `stacks` version.')

  const meta = (await res.json()) as {
    'dist-tags'?: Record<string, string>
    'versions'?: Record<string, { dependencies?: Record<string, string> }>
  }
  const distTags = meta['dist-tags'] ?? {}
  const versions = meta.versions ?? {}

  let version: string
  if (options.version) {
    if (!versions[options.version])
      throw new Error(`stacks@${options.version} was not found on the npm registry.`)
    version = options.version
  }
  else {
    const tag = options.canary ? 'canary' : 'latest'
    const resolved = distTags[tag]
    if (!resolved)
      throw new Error(`The \`${tag}\` dist-tag is not published for \`stacks\`.`)
    version = resolved
  }

  // The `stacks` meta declares every framework dependency at the version that
  // release actually ships: lockstep core packages at the meta's own version
  // (e.g. `@stacksjs/server: ^0.70.161`) and independently-versioned ones on
  // their own line (e.g. `@stacksjs/tlsx: ^0.13.0`, `@stacksjs/ts-cloud: ^0.7.49`).
  // Return the full map so the caller only force-bumps the lockstep set and never
  // drags an independent package to a framework version it doesn't publish
  // (stacksjs/stacks#2078).
  const metaDeps = versions[version]?.dependencies ?? {}

  return { version, metaDeps }
}

/** Strip a range operator (`^`, `~`, `>=`, …) so a declared range compares to a bare version. */
export function baseVersion(range: string): string {
  return range.replace(/^[\^~>=<\s]+/, '').trim()
}

/**
 * The packages `buddy upgrade` may move to the framework `target`: the `stacks`
 * meta itself, plus every `@stacksjs/*` dependency the meta declares AT that
 * target version. Independently-versioned `@stacksjs/*` packages — the ones the
 * meta pins on their own line (tlsx, ts-cloud, …) — and non-`@stacksjs/*` tooling
 * (e.g. `better-dx`) are excluded, so they are never force-bumped to a framework
 * version they don't publish (stacksjs/stacks#2078).
 */
export function lockstepPackages(metaDeps: Record<string, string>, target: string): Set<string> {
  const lockstep = new Set<string>(['stacks'])
  for (const [name, range] of Object.entries(metaDeps)) {
    if (name.startsWith('@stacksjs/') && baseVersion(range) === target)
      lockstep.add(name)
  }
  return lockstep
}

/**
 * Bump the lockstep packages in the app's package.json to `target`, preserving
 * each spec's existing range prefix (`^`, `~`, or exact pin). Anything not in
 * `lockstep` — including independently-versioned `@stacksjs/*` packages — is left
 * untouched. Returns the set of applied changes.
 */
export function applyBumps(pkg: PkgJson, target: string, lockstep: Set<string>): Array<{ name: string, from: string, to: string }> {
  const changes: Array<{ name: string, from: string, to: string }> = []

  for (const field of ['dependencies', 'devDependencies'] as const) {
    const deps = pkg[field]
    if (!deps)
      continue

    for (const [name, spec] of Object.entries(deps)) {
      if (!lockstep.has(name))
        continue

      // Preserve the range operator the app already uses; default to caret.
      const prefix = /^[\^~]/.test(spec) ? spec[0] : (/^\d/.test(spec) ? '' : '^')
      const next = `${prefix}${target}`
      if (spec !== next) {
        changes.push({ name, from: spec, to: next })
        deps[name] = next
      }
    }
  }

  return changes
}

/**
 * Upgrade a node_modules app to a published framework version. Called by the
 * framework upgrade script when no vendored `storage/framework/core` exists.
 * Handles resolution, package.json rewrite, and reinstall; then `process.exit`s.
 */
export async function upgradeStacksPackages(projectRoot: string, options: PackageUpgradeOptions): Promise<never> {
  const pkgPath = join(projectRoot, 'package.json')
  if (!existsSync(pkgPath)) {
    console.error('No package.json found — nothing to upgrade.')
    process.exit(1)
  }

  const raw = readFileSync(pkgPath, 'utf-8')
  const pkg = JSON.parse(raw) as PkgJson
  const current = pkg.dependencies?.stacks ?? pkg.devDependencies?.stacks

  if (!hasStacksDependency(pkg))
    return updateStandalonePackage(projectRoot, options)

  const { version: target, metaDeps } = await resolveTarget(options).catch((err: Error) => {
    console.error(`✗ ${err.message}`)
    process.exit(1)
  })

  console.log(`\n  Upgrading the Stacks framework${options.canary ? ' (canary)' : ''} → ${target}`)
  if (current)
    console.log(`  current \`stacks\` constraint: ${current}\n`)

  const lockstep = lockstepPackages(metaDeps, target)
  const changes = applyBumps(pkg, target, lockstep)
  const projectManifestChanges = migratePackageProjectManifest(pkg)

  // The root manifest is not the whole story. An app that keeps parts of the
  // framework in its own tree has manifests under storage/framework that
  // declare their own @stacksjs/* dependencies, and an upgrade that ignores
  // them leaves the app describing two framework versions at once — or, once
  // a vendored core is removed, unable to install at all.
  const manifestChanges = reconcileVendoredManifests(projectRoot, target, { dryRun: options.dryRun })

  if (changes.length > 0) {
    console.log('  The following dependencies will be updated:')
    const width = Math.max(...changes.map(c => c.name.length))
    for (const c of changes)
      console.log(`    ${c.name.padEnd(width)}  ${c.from}  →  ${c.to}`)
    console.log('')
  }

  if (manifestChanges.length > 0) {
    console.log(`  Vendored manifests under storage/framework (${manifestChanges.length}):`)
    const width = Math.max(...manifestChanges.map(c => c.name.length))
    for (const c of manifestChanges)
      console.log(`    ${c.name.padEnd(width)}  ${c.from}  →  ${c.to}   ${c.file}`)
    console.log('')
  }

  if (projectManifestChanges.length > 0)
    console.log(`  Project manifest migrations: ${projectManifestChanges.length}\n`)

  if (options.dryRun) {
    // Manifest rewrites are the small half of an upgrade. The large half is the
    // scaffold under storage/framework/defaults, and a preview that reports
    // only the former reads as "this upgrade touches four files" when it is
    // about to rewrite hundreds. The comparison is against the version
    // installed right now, because the target is not on disk yet.
    const pending = measureDefaultsDrift(projectRoot)
    if (pending && pending.length > 0) {
      const installed = installedDefaultsVersion(projectRoot)
      console.log(`  Managed project files, against the installed @stacksjs/defaults${installed ? ` (${installed})` : ''}:`)
      console.log(`    ${summarizeStructureChanges(pending)}   in storage/framework/defaults and project support files\n`)
    }

    console.log('  --dry-run: no files were written and nothing was installed.\n')
    process.exit(0)
  }

  if (changes.length > 0 || projectManifestChanges.length > 0) {
    // Preserve trailing newline convention of the original file.
    const trailing = raw.endsWith('\n') ? '\n' : ''
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}${trailing}`)
    console.log('✔ Updated package.json')
  }

  if (options.noPostinstall) {
    console.log('  --no-postinstall: skipping install. Run this to pull the new versions:')
    console.log(`    ${frameworkPackageUpdateCommand()}\n`)
    process.exit(0)
  }

  if (changes.length > 0 || manifestChanges.length > 0 || projectManifestChanges.length > 0 || options.force) {
    console.log('  Installing…\n')
    const result = await runCommand(frameworkPackageUpdateCommand(), { cwd: projectRoot })

    if (result.isErr) {
      console.error('\n✗ The install step failed. Your package.json was updated — resolve the error and re-run `bun update`.\n')
      process.exit(1)
    }
  }

  const defaultsPackageRoot = join(projectRoot, 'node_modules/@stacksjs/defaults')
  const structureChanges = existsSync(join(defaultsPackageRoot, 'package.json'))
    ? syncPackageProjectFiles(projectRoot, defaultsPackageRoot)
    : []
  const tsconfigChanges = migratePackageProjectTsconfig(projectRoot)

  if (structureChanges.length > 0 || tsconfigChanges.length > 0) {
    const added = structureChanges.filter(change => change.action === 'add').length
    const updated = structureChanges.filter(change => change.action === 'update').length + tsconfigChanges.length
    const removed = structureChanges.filter(change => change.action === 'remove').length
    console.log(`  Project structure: +${added} ~${updated} -${removed}`)
  }

  for (const provider of detectProjectAiProviders(projectRoot)) {
    const result = await runCommand(`./buddy setup:ai ${provider} --force`, { cwd: projectRoot })
    if (result.isErr) {
      console.error(`\n✗ AI setup refresh failed for ${provider}. Re-run \`buddy setup:ai ${provider} --force\`.\n`)
      process.exit(1)
    }
  }

  const didChange = changes.length > 0
    || manifestChanges.length > 0
    || projectManifestChanges.length > 0
    || structureChanges.length > 0
    || tsconfigChanges.length > 0

  if (!didChange && !options.force)
    console.log('\n✔ Already up to date — dependencies and managed project files match the target.\n')
  else
    console.log(`\n✔ Upgraded to stacks@${target}. Review the changelog: https://github.com/stacksjs/stacks/releases/tag/v${target}\n`)
  process.exit(0)
}

/** One manifest the reconcile rewrote, for reporting. */
export interface ManifestChange {
  /** Path relative to the project root. */
  file: string
  name: string
  from: string
  to: string
}

/**
 * Decide the spec a vendored manifest's framework dependency should carry.
 *
 * Returns null when it is already correct, or when the dependency is not one
 * the framework versions in lockstep.
 *
 * `workspace:*` is the case that matters. An app that vendored
 * `storage/framework/core` had every `@stacksjs/*` package present locally, so
 * the manifests under `storage/framework/**` pointed at them by workspace
 * reference. Delete that directory to move onto published packages and those
 * references resolve to nothing: `bun install` fails outright with
 * "@stacksjs/utils@workspace:* failed to resolve", and the app cannot install
 * at all until every one of them is rewritten by hand.
 */
export function resolveManifestSpec(name: string, spec: string, target: string): string | null {
  if (name !== 'stacks' && !name.startsWith('@stacksjs/'))
    return null

  if (spec.startsWith('workspace:'))
    return `^${target}`

  // A pinned or ranged version that is already on target needs nothing.
  if (baseVersion(spec) === target)
    return null

  // Leave anything exotic (a git url, a file: link, a tag) alone: it was set
  // deliberately and guessing at it would be worse than leaving it.
  if (!/^[\^~]?\d/.test(spec))
    return null

  const prefix = /^[\^~]/.test(spec) ? spec[0] : ''
  return `${prefix}${target}`
}

/**
 * Point the vendored `storage/framework/**` manifests at the target version.
 *
 * The root package.json is not the whole story for an app that keeps parts of
 * the framework in its own tree. Those manifests declare their own
 * `@stacksjs/*` dependencies, and an upgrade that ignores them leaves the app
 * describing two different framework versions at once - or, after a vendored
 * core is removed, unable to install.
 *
 * Returns what changed so the caller can report it. Writes nothing when
 * `dryRun` is set.
 */
export function reconcileVendoredManifests(
  projectRoot: string,
  target: string,
  options: { dryRun?: boolean } = {},
): ManifestChange[] {
  const root = join(projectRoot, 'storage/framework')
  if (!existsSync(root))
    return []

  const changes: ManifestChange[] = []

  const walk = (dir: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    }
    catch {
      return
    }

    for (const entry of entries) {
      // Skip installed and built trees: their manifests are not ours to edit.
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git')
        continue

      const full = join(dir, entry)
      let stat
      try {
        stat = statSync(full)
      }
      catch {
        continue
      }

      if (stat.isDirectory()) {
        walk(full)
        continue
      }

      if (entry !== 'package.json')
        continue

      let raw: string
      try {
        raw = readFileSync(full, 'utf-8')
      }
      catch {
        continue
      }

      let pkg: PkgJson
      try {
        pkg = JSON.parse(raw) as PkgJson
      }
      catch {
        // A malformed manifest is the app's to fix; skipping beats throwing
        // in the middle of an upgrade.
        continue
      }

      let touched = false
      for (const field of ['dependencies', 'devDependencies'] as const) {
        const deps = pkg[field]
        if (!deps)
          continue

        for (const [name, spec] of Object.entries(deps)) {
          const next = resolveManifestSpec(name, spec, target)
          if (!next)
            continue

          changes.push({ file: relative(projectRoot, full), name, from: spec, to: next })
          deps[name] = next
          touched = true
        }
      }

      if (touched && !options.dryRun) {
        // Match the trailing newline convention of the file we read.
        const suffix = raw.endsWith('\n') ? '\n' : ''
        writeFileSync(full, `${JSON.stringify(pkg, null, 2)}${suffix}`)
      }
    }
  }

  walk(root)
  return changes
}
