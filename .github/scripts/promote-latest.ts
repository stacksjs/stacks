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
 * All versions are confirmed before any tag moves. A partial promotion fails
 * loudly with the exact remaining set, so the release can resume without
 * uploading an accepted package again.
 *
 * Run: `bun .github/scripts/promote-latest.ts [--dry-run] [--oidc]`
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { exchangePromotionToken, recordPromotionPermissions, validatePromotionPermissions } from './npm-oidc-promotion'

export interface Publishable {
  name: string
  version: string
  dir: string
}

/** Select the publication path before any package receives its initial tag. */
export async function npmPublicationTag(token: string, registry = 'https://registry.npmjs.org'): Promise<'staging' | 'latest'> {
  if (!token.trim())
    return 'latest'
  const response = await fetch(new URL('/-/whoami', registry), {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  })
  if (response.status === 401)
    return 'latest'
  if (!response.ok)
    throw new Error(`Could not check npm promotion credentials: registry HTTP ${response.status}`)
  return 'staging'
}

/**
 * An accepted upload can remain unavailable during npm's automated review.
 * Defaults 0.75.122 was still Validating when the old five-minute budget ran
 * out. Allow thirty minutes for that review while keeping the exact manifest
 * check: neither a successful upload nor a dist-tag write proves availability.
 */
export async function confirmPublications(
  packages: Publishable[],
  registry = 'https://registry.npmjs.org',
  attempts = 180,
  retryDelayMs = 10_000,
  selection: 'version' | 'latest' = 'version',
): Promise<void> {
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error('Publication confirmation requires at least one attempt')
  let pending = packages
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const results = await Promise.all(pending.map(async (pkg) => {
      try {
        const target = selection === 'latest' ? 'latest' : pkg.version
        const result = await fetch(`${registry.replace(/\/$/, '')}/${encodeURIComponent(pkg.name)}/${encodeURIComponent(target)}`, { signal: AbortSignal.timeout(20_000), cache: 'no-store' })
        if (!result.ok) return pkg
        const manifest = await result.json() as { name?: string, version?: string, dist?: { tarball?: string } }
        return manifest.name === pkg.name && manifest.version === pkg.version && typeof manifest.dist?.tarball === 'string' ? null : pkg
      }
      catch { return pkg }
    }))
    pending = results.filter((pkg): pkg is Publishable => pkg !== null)
    if (!pending.length) return
    if (attempt < attempts) await Bun.sleep(retryDelayMs)
  }
  const unconfirmed = pending.map(pkg => `${pkg.name}@${pkg.version}`).join(', ')
  if (selection === 'latest') throw new Error(`Registry did not confirm latest for ${unconfirmed}`)
  throw new Error(`Registry did not confirm publication of ${unconfirmed}. Accepted uploads may still be awaiting npm automated review.`)
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

/**
 * The line of npm's stderr worth printing.
 *
 * npm ends every failure with two lines of housekeeping - a blank `npm error`
 * and "A complete log of this run can be found in: /home/runner/.npm/_logs/...".
 * Taking the last line, as this did, reported that path as the error and told
 * the reader nothing: a real promotion failure showed up as
 * `stacks@0.74.14: npm error A complete log of this run can be found in: ...`.
 * The runner is gone by the time anyone reads the log, so that path is not
 * even recoverable.
 */
export function meaningfulNpmError(stderr: string): string {
  const lines = stderr
    .split('\n')
    .map(line => line.replace(/^npm (error|ERR!)\s*/, '').trim())
    .filter(Boolean)
    .filter(line => !/^A complete log of this run/.test(line))
    .filter(line => !/^code\s/.test(line))

  // Prefer the first substantive line: npm leads with the cause (`E403`,
  // `E404`, "You cannot publish over...") and follows with context.
  return lines[0] ?? 'no error output'
}

/** Tag writes in flight at once. */
export const PROMOTE_CONCURRENCY = 12

/** `task` over `items`, at most `limit` at a time, results in input order. */
export async function inParallel<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const at = next++
      results[at] = await task(items[at]!)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return results
}

/** Promote exact versions with one shared cooldown for the registry. */
export async function promoteTags(packages: Publishable[], options: {
  token: string | ReadonlyMap<string, string>
  registry?: string
  attempts?: number
  concurrency?: number
  budgetMs?: number
}): Promise<string[]> {
  const credentials = options.token
  if (typeof credentials === 'string' && !credentials.trim()) throw new Error('Tag promotion requires NPM_TOKEN')
  const authorized = packages.map((pkg) => {
    const token = typeof credentials === 'string' ? credentials : credentials.get(pkg.name)
    if (!token?.trim()) throw new Error(`Missing npm promotion token for ${pkg.name}`)
    return { pkg, token }
  })
  const registry = new URL(options.registry ?? 'https://registry.npmjs.org')
  const loopback = registry.protocol === 'http:' && registry.hostname === '127.0.0.1'
  if ((!loopback && registry.origin !== 'https://registry.npmjs.org') || registry.username || registry.password || registry.pathname !== '/' || registry.search || registry.hash)
    throw new Error('Tag promotion requires the public registry or an owned loopback fixture')
  const attempts = options.attempts ?? 5
  const concurrency = options.concurrency ?? PROMOTE_CONCURRENCY
  const budgetMs = options.budgetMs ?? 600_000
  if (!Number.isSafeInteger(attempts) || attempts < 1 || !Number.isSafeInteger(concurrency) || concurrency < 1 || !Number.isSafeInteger(budgetMs) || budgetMs < 1)
    throw new Error('Tag promotion requires positive integer limits')
  const deadline = performance.now() + budgetMs
  let resumeAt = 0
  const results = await inParallel(authorized, concurrency, async ({ pkg, token }) => {
    let last = 'registry request failed'
    for (let attempt = 1; attempt <= attempts; attempt++) {
      while (resumeAt > performance.now() && resumeAt < deadline)
        await Bun.sleep(resumeAt - performance.now())
      const remaining = Math.floor(deadline - performance.now())
      if (remaining <= 0) return `${pkg.name}@${pkg.version}: promotion deadline exceeded`
      if (resumeAt >= deadline) return `${pkg.name}@${pkg.version}: registry cooldown exceeds promotion deadline`
      let delay = attempt * 3000
      try {
        // npm's dist-tag CLI first reads every tag. A release already knows
        // the exact desired version: write that single tag through the same
        // registry endpoint without doubling the registry request count.
        const response = await fetch(new URL(`/-/package/${encodeURIComponent(pkg.name)}/dist-tags/latest`, registry), {
          method: 'PUT', redirect: 'error',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(pkg.version), signal: AbortSignal.timeout(Math.min(20_000, remaining)),
        })
        await response.body?.cancel()
        if (response.ok) return null
        last = `registry HTTP ${response.status}`
        if (response.status !== 429 && response.status !== 408 && response.status < 500) break
        const retryAfter = response.headers.get('retry-after')
        const seconds = retryAfter !== null && /^\d+$/.test(retryAfter) ? Number(retryAfter) : Number.NaN
        const date = retryAfter === null ? Number.NaN : Date.parse(retryAfter)
        delay = Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(date) ? Math.max(0, date - Date.now()) : response.status === 429 ? 60_000 : delay
      }
      catch {
        // Registry errors can contain credentials or response bodies. Keep
        // diagnostics fixed, and never follow a credential-bearing redirect.
        last = 'registry request failed'
      }
      resumeAt = Math.max(resumeAt, performance.now() + delay)
    }
    return `${pkg.name}@${pkg.version}: ${last}`
  })
  return results.filter((failure): failure is string => failure !== null)
}

/** A failed response cannot prove whether that write reached the registry. */
export function promotionFailureSummary(acknowledged: number, total: number): string {
  return `${acknowledged} of ${total} tag writes were acknowledged. Remaining tag states are unconfirmed; the registry may contain a partial release. Resume promotion before declaring this release complete.`
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verifyOnly = args.includes('--verify-only')
  const root = process.cwd()
  const permissions = process.env.RELEASE_NPM_OIDC_PERMISSIONS?.trim()
  if (args.includes('--publication-tag') && !permissions) {
    process.stdout.write(`${await npmPublicationTag(process.env.NPM_TOKEN ?? '')}\n`)
    return
  }

  const umbrella = await Bun.file(join(root, 'storage/framework/core/package.json')).json() as { name: string, version: string }
  if (args.includes('--verify-umbrella')) {
    await confirmPublications([{ ...umbrella, dir: 'storage/framework/core' }], undefined, undefined, undefined, 'latest')
    console.log(`  registry confirmed latest for ${umbrella.name}@${umbrella.version}`)
    return
  }

  const packages = await publishables(root)
  if (args[0] === '--record-oidc-permissions') {
    const [, directory, version] = args
    if (!directory || !version) throw new Error('Usage: --record-oidc-permissions <npm trust response directory> <release version>')
    const receipt = await recordPromotionPermissions(packages, version, async (name) => {
      try { return await Bun.file(join(directory, `${encodeURIComponent(name)}.json`)).json() }
      catch { throw new Error(`Could not read the npm trust response for ${name}`) }
    })
    process.stdout.write(`${JSON.stringify(receipt)}\n`)
    return
  }

  const oidc = args.includes('--oidc') || (args.includes('--publication-tag') && Boolean(permissions))
  const oidcTokens = async (): Promise<Map<string, string>> => {
    validatePromotionPermissions(permissions ?? '', packages, umbrella.version)
    const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL
    const identityCredential = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
    if (!url || !identityCredential) throw new Error('GitHub Actions OIDC is unavailable to the npm promotion job')
    let identityUrl: URL
    try { identityUrl = new URL(url) }
    catch { throw new Error('Invalid GitHub Actions identity endpoint') }
    const entries = await inParallel(packages, 8, async pkg => [pkg.name, await exchangePromotionToken(pkg.name, identityUrl, identityCredential)] as const)
    return new Map(entries)
  }

  if (args.includes('--publication-tag')) {
    await oidcTokens()
    process.stdout.write('staging-oidc\n')
    return
  }

  console.log(`${verifyOnly ? 'verifying' : 'promoting'} ${packages.length} package(s)`)

  if (dryRun) {
    for (const pkg of packages)
      console.log(`  would promote ${pkg.name}@${pkg.version}`)
    return
  }

  if (verifyOnly) {
    await confirmPublications(packages, undefined, undefined, undefined, 'latest')
    console.log(`  registry confirmed latest for all ${packages.length} scoped packages`)
    return
  }

  // Check the whole set before moving any tag or publishing the meta-package.
  // npm accepted Buddy 0.75.115 and allowed its tag write, but never exposed
  // that version. Advancing stacks first left clean installs impossible.
  let started = performance.now()
  await confirmPublications(packages)
  console.log(`  registry confirmed all ${packages.length} in ${Math.round((performance.now() - started) / 1000)}s`)

  // Several tag writes at once. One at a time took minutes for 85 packages
  // (v0.75.236: 11 minutes with the confirmation above), and for all of that
  // time `latest` spanned two releases: the window this script exists to close.
  started = performance.now()
  const token = oidc ? await oidcTokens() : process.env.NPM_TOKEN ?? ''
  const failures = await promoteTags(packages, { token })
  const promoted = packages.length - failures.length
  console.log(`  acknowledged ${promoted} tag write(s) in ${Math.round((performance.now() - started) / 1000)}s`)

  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${packages.length} package(s) could not be promoted to latest:\n`)
    for (const failure of failures)
      console.error(`  ✗ ${failure}`)

    console.error(`\n${promotionFailureSummary(promoted, packages.length)}`)
    console.error('Re-run this job, or finish by hand with `npm dist-tag add <pkg>@<version> latest`.\n')
    process.exit(1)
  }

  await confirmPublications(packages, undefined, undefined, undefined, 'latest')
  console.log(`✓ latest now points at this release for all ${packages.length} package(s)`)
}

if (import.meta.main)
  await main()
