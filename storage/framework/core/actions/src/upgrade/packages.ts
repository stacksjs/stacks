// Node-modules app upgrade path. Unlike `framework.ts` (which syncs vendored
// framework *source* into storage/framework/core), an app that consumes the
// published framework from node_modules upgrades by bumping its `stacks` +
// `@stacksjs/*` dependency versions and reinstalling — the "Laravel Shift"
// style framework bump. We deliberately use `console.*` + `process.exit` here
// (same as framework.ts) because the calling script exits synchronously.
/* eslint-disable no-console */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { runCommand } from '@stacksjs/cli'

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

interface PkgJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

/** Resolve the target version + the set of lockstep core packages from the registry. */
async function resolveTarget(options: PackageUpgradeOptions): Promise<{ version: string, coreDeps: Set<string> }> {
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

  // The core packages are exactly those the `stacks` meta depends on — they are
  // released in lockstep at the same version. Every *other* `@stacksjs/*` dep
  // (e.g. ts-cloud, bun-query-builder) is versioned independently and must NOT
  // be dragged to the meta's version, so we scope the bump to this set.
  const coreDeps = new Set(Object.keys(versions[version]?.dependencies ?? {}))

  return { version, coreDeps }
}

/**
 * Bump the `stacks` meta and its lockstep core packages in the app's
 * package.json to `target`, preserving each spec's existing range prefix
 * (`^`, `~`, or exact pin). Independently-versioned `@stacksjs/*` packages are
 * left untouched. Returns the set of applied changes.
 */
function applyBumps(pkg: PkgJson, target: string, coreDeps: Set<string>): Array<{ name: string, from: string, to: string }> {
  const changes: Array<{ name: string, from: string, to: string }> = []
  // Lockstep = the `stacks` meta itself, or a scoped `@stacksjs/*` core package
  // the meta declares. The `@stacksjs/` guard matters because the meta also
  // depends on independently-versioned third-party tooling (e.g. `better-dx`),
  // which appears in `coreDeps` but must not be dragged to the meta version.
  const isLockstep = (name: string): boolean =>
    name === 'stacks' || (name.startsWith('@stacksjs/') && coreDeps.has(name))

  for (const field of ['dependencies', 'devDependencies'] as const) {
    const deps = pkg[field]
    if (!deps)
      continue

    for (const [name, spec] of Object.entries(deps)) {
      if (!isLockstep(name))
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

  const { version: target, coreDeps } = await resolveTarget(options).catch((err: Error) => {
    console.error(`✗ ${err.message}`)
    process.exit(1)
  })

  console.log(`\n  Upgrading the Stacks framework${options.canary ? ' (canary)' : ''} → ${target}`)
  if (current)
    console.log(`  current \`stacks\` constraint: ${current}\n`)

  const changes = applyBumps(pkg, target, coreDeps)

  if (changes.length === 0 && !options.force) {
    console.log('✔ Already up to date — every framework dependency matches the target.\n')
    process.exit(0)
  }

  if (changes.length > 0) {
    console.log('  The following dependencies will be updated:')
    const width = Math.max(...changes.map(c => c.name.length))
    for (const c of changes)
      console.log(`    ${c.name.padEnd(width)}  ${c.from}  →  ${c.to}`)
    console.log('')
  }

  if (options.dryRun) {
    console.log('  --dry-run: no files were written and nothing was installed.\n')
    process.exit(0)
  }

  if (changes.length > 0) {
    // Preserve trailing newline convention of the original file.
    const trailing = raw.endsWith('\n') ? '\n' : ''
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}${trailing}`)
    console.log('✔ Updated package.json')
  }

  // The lockstep framework packages to refresh. The `stacks` meta pins its
  // core deps with caret ranges (e.g. `^0.70.53`), so a plain `bun install`
  // leaves stale-but-in-range transitive versions in the lockfile untouched —
  // the app would keep running the OLD buddy/actions. `bun update <names>`
  // moves each named package (including transitive ones) to the newest version
  // that satisfies the range, rewriting the lockfile. We scope it to `stacks`
  // + the scoped core packages so independent deps (ts-cloud, better-dx) and
  // the rest of the tree are left alone.
  const frameworkPkgs = ['stacks', ...[...coreDeps].filter(n => n.startsWith('@stacksjs/'))]

  if (options.noPostinstall) {
    console.log('  --no-postinstall: skipping install. Run this to pull the new versions:')
    console.log(`    bun update ${frameworkPkgs.slice(0, 3).join(' ')} …\n`)
    process.exit(0)
  }

  console.log('  Installing…\n')
  const result = await runCommand(`bun update ${frameworkPkgs.join(' ')}`, { cwd: projectRoot })
  const isErr = result.isErr

  if (isErr) {
    console.error('\n✗ The install step failed. Your package.json was updated — resolve the error and re-run `bun update`.\n')
    process.exit(1)
  }

  console.log(`\n✔ Upgraded to stacks@${target}. Review the changelog: https://github.com/stacksjs/stacks/releases/tag/v${target}\n`)
  process.exit(0)
}
