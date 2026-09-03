/**
 * Move the `latest` dist-tag onto this release, for every framework package.
 *
 * `pantry publish` uploads ~180 packages one at a time, and each one lands on
 * `latest` the moment it is uploaded. For the minutes that takes, the registry
 * describes no single release: an install resolving `^0.74.12` gets whatever
 * each package had reached, which is how one CI run pulled
 * `@stacksjs/actions@0.74.12` alongside `@stacksjs/ai@0.74.13` and produced an
 * app that could not resolve its own imports (stacksjs/stacks#2056).
 *
 * So the release publishes under a holding tag instead, and this promotes the
 * whole set afterwards. Moving a dist-tag is a metadata write measured in
 * milliseconds, so the window where the registry disagrees with itself goes
 * from minutes to about a second.
 *
 * The failure mode is the point: if promotion cannot finish, `latest` still
 * points at the previous release. Consumers keep resolving a complete set
 * rather than half of two.
 *
 * Run: `bun .github/scripts/promote-latest.ts [--dry-run] [--tag <holding>]`
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export interface Publishable {
  name: string
  version: string
  dir: string
}

/**
 * Every scoped workspace package the release publishes under the holding tag.
 * The unscoped `stacks` meta-package is deliberately excluded: npm trusted
 * publishing can publish it through OIDC, but `npm dist-tag` requires a token
 * with separate ownership of that package. The workflow publishes `stacks`
 * directly to `latest` only after this scoped set has been promoted.
 */
export async function publishables(root: string): Promise<Publishable[]> {
  // `process.cwd()` has no trailing slash and a URL-derived path does, and the
  // difference silently shifted every reported path by one character.
  const base = root.endsWith('/') ? root.slice(0, -1) : root
  const coreDir = join(base, 'storage/framework/core')
  const dirs = [
    ...readdirSync(coreDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => join(coreDir, entry.name)),
  ]

  const found: Publishable[] = []
  for (const dir of dirs) {
    const manifestPath = join(dir, 'package.json')
    if (!existsSync(manifestPath))
      continue

    const manifest = await Bun.file(manifestPath).json()
    // `private` never reaches the registry, and a manifest without a name or
    // version is not something `npm dist-tag` can address.
    if (!manifest.name || !manifest.version || manifest.private)
      continue

    found.push({ name: manifest.name, version: manifest.version, dir: dir.slice(base.length + 1) })
  }

  return found
}

async function promote(pkg: Publishable): Promise<string | null> {
  // Three attempts: a dist-tag write can lose to npm's own replication right
  // after a publish, and retrying is cheaper than stranding the release.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const proc = Bun.spawn(['npm', 'dist-tag', 'add', `${pkg.name}@${pkg.version}`, 'latest'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (await proc.exited === 0)
      return null

    const stderr = (await new Response(proc.stderr).text()).trim()
    if (attempt === 3)
      return `${pkg.name}@${pkg.version}: ${stderr.split('\n').pop() ?? 'unknown error'}`

    await Bun.sleep(attempt * 2000)
  }

  return null
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const root = process.cwd()
  const packages = await publishables(root)

  console.log(`promoting ${packages.length} package(s) to latest`)

  if (dryRun) {
    for (const pkg of packages)
      console.log(`  would promote ${pkg.name}@${pkg.version}`)
    return
  }

  const failures: string[] = []
  for (const pkg of packages) {
    const failure = await promote(pkg)
    if (failure)
      failures.push(failure)
  }

  if (failures.length > 0) {
    // Every failure at once: a half-promoted release needs the whole list to
    // finish by hand, not the first name that went wrong.
    console.error(`\n${failures.length} package(s) could not be promoted to latest:\n`)
    for (const failure of failures)
      console.error(`  ✗ ${failure}`)
    console.error('\n`latest` still points at the previous release, so consumers are on a complete set.')
    console.error('Re-run this job, or finish by hand with `npm dist-tag add <pkg>@<version> latest`.\n')
    process.exit(1)
  }

  console.log(`✓ latest now points at this release for all ${packages.length} package(s)`)
}

if (import.meta.main)
  await main()
