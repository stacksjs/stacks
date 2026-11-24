/**
 * Which registries a framework release publishes to.
 *
 * Pantry by default. npm is opt-in: set the repository variable
 * `RELEASE_REGISTRIES` to a comma-separated list (`pantry,npm`, or `npm`).
 *
 * Publishing to npm was most of every release. 85 packages had to go out one
 * dependency layer at a time, because npm makes each upload wait to become
 * readable and a package cannot be published before the ones it depends on
 * are readable (v0.75.663: 8 minutes to publish, 9 more waiting for npm to
 * serve the set to a clean install). The Pantry registry answers a publish
 * with the version already installable, so `pantry publish` uploads the whole
 * workspace in parallel in seconds, and its `/npm/` endpoint serves the same
 * packages to Bun and npm.
 *
 * Run: `bun .github/scripts/release-registries.ts` (prints `pantry=true` and
 * `npm=false` lines for `$GITHUB_OUTPUT`).
 */
import { appendFileSync } from 'node:fs'
import process from 'node:process'

export const RELEASE_REGISTRIES = ['pantry', 'npm'] as const
export type ReleaseRegistry = typeof RELEASE_REGISTRIES[number]

/** The default when nothing is configured. */
export const DEFAULT_RELEASE_REGISTRIES: readonly ReleaseRegistry[] = ['pantry']

/**
 * Parse a configured list. Empty means the default; an unknown name is an
 * error rather than ignored, so a typo cannot quietly drop a registry.
 */
export function releaseRegistries(configured: string | undefined): ReleaseRegistry[] {
  const names = (configured ?? '').split(/[\s,]+/).map(name => name.trim().toLowerCase()).filter(Boolean)
  if (!names.length) return [...DEFAULT_RELEASE_REGISTRIES]
  const unknown = names.filter(name => !(RELEASE_REGISTRIES as readonly string[]).includes(name))
  if (unknown.length)
    throw new Error(`RELEASE_REGISTRIES names ${unknown.join(', ')}; the registries are ${RELEASE_REGISTRIES.join(', ')}`)
  return RELEASE_REGISTRIES.filter(name => names.includes(name))
}

/** `name=true|false` per registry, for a step's outputs. */
export function registryOutputs(registries: ReleaseRegistry[]): string {
  return RELEASE_REGISTRIES.map(name => `${name}=${registries.includes(name)}`).join('\n')
}

if (import.meta.main) {
  try {
    const registries = releaseRegistries(process.env.RELEASE_REGISTRIES)
    const outputs = registryOutputs(registries)
    console.log(`Publishing to ${registries.join(' and ')}${process.env.RELEASE_REGISTRIES ? '' : ' (the default; set RELEASE_REGISTRIES to change it)'}`)
    console.log(outputs)
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${outputs}\n`)
  }
  catch (error) {
    console.error(`::error title=Release registries::${(error as Error).message}`)
    process.exit(1)
  }
}
