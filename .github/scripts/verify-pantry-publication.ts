/**
 * Confirm every framework package of this release is on the Pantry registry,
 * published there rather than mirrored from npm.
 *
 * The registry answers `/packages/{name}/{version}` for a version it does not
 * hold by falling back to npm, so a 200 alone proves nothing: a package that
 * never reached Pantry would pass on npm's copy. A fallback carries npm's
 * tarball URL; Pantry's own publications carry one on Pantry, under the
 * server's public base URL (https://pantry.dev in production, not the
 * registry.pantry.dev host this reads from).
 *
 * Pantry answers a publish with the version already readable, so there is no
 * propagation to wait out here: one pass, a short retry for a network blip.
 *
 * Run: `bun .github/scripts/verify-pantry-publication.ts [--registry <url>]`
 */
import { join } from 'node:path'
import process from 'node:process'
import type { Publishable } from './promote-latest'
import { inParallel, publishables } from './promote-latest'

export const PANTRY_REGISTRY = 'https://registry.pantry.dev'

/** A tarball npm serves, which is what the registry's npm fallback returns. */
export function isNpmTarball(url: string): boolean {
  try { return /(^|\.)npmjs\.(org|com)$/.test(new URL(url).hostname) }
  catch { return true }
}

export type PublicationCheck = { pkg: Publishable, ok: true } | { pkg: Publishable, ok: false, reason: string }

/** Whether `pkg` is published on the Pantry registry itself. */
export async function checkPantryPublication(
  pkg: Publishable,
  registry = PANTRY_REGISTRY,
  attempts = 3,
  retryDelayMs = 2_000,
): Promise<PublicationCheck> {
  const base = registry.replace(/\/$/, '')
  let reason = 'not checked'
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(`${base}/packages/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`, { signal: AbortSignal.timeout(20_000), cache: 'no-store' })
      if (response.status === 404) return { pkg, ok: false, reason: 'not on the registry' }
      if (!response.ok) {
        reason = `HTTP ${response.status}`
      }
      else {
        const metadata = await response.json() as { name?: string, version?: string, tarballUrl?: string }
        if (metadata.name !== pkg.name || metadata.version !== pkg.version)
          return { pkg, ok: false, reason: `the registry answered ${metadata.name}@${metadata.version}` }
        if (!metadata.tarballUrl || isNpmTarball(metadata.tarballUrl))
          return { pkg, ok: false, reason: `only npm's copy (${metadata.tarballUrl ?? 'no tarball'}) is served; Pantry holds no publication of it` }
        return { pkg, ok: true }
      }
    }
    catch (error) {
      reason = (error as Error).message
    }
    if (attempt < attempts) await Bun.sleep(retryDelayMs)
  }
  return { pkg, ok: false, reason }
}

/** Every package the release publishes: the scoped set and the `stacks` meta-package. */
export async function releasePackages(root: string): Promise<Publishable[]> {
  const packages = await publishables(root)
  const meta = await Bun.file(join(root, 'storage/framework/core/package.json')).json()
  if (meta.name && meta.version && !meta.private)
    packages.push({ name: meta.name, version: meta.version, dir: 'storage/framework/core' })
  return packages
}

async function main(): Promise<void> {
  const at = process.argv.indexOf('--registry')
  const registry = at > -1 ? process.argv[at + 1]! : PANTRY_REGISTRY
  const root = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
  const packages = await releasePackages(root)
  const results = await inParallel(packages, 16, pkg => checkPantryPublication(pkg, registry))
  const missing = results.filter((result): result is Extract<PublicationCheck, { ok: false }> => !result.ok)
  for (const result of missing) console.log(`::error title=Pantry publication::${result.pkg.name}@${result.pkg.version}: ${result.reason}`)
  if (missing.length) {
    console.log(`${missing.length} of ${packages.length} packages are not on ${registry}`)
    process.exit(1)
  }
  console.log(`All ${packages.length} packages are on ${registry}`)
}

if (import.meta.main)
  await main()
