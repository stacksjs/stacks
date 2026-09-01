/**
 * What npm actually has.
 *
 * Both scaffolding and unvendoring have to reconcile the checkout in front of
 * them with the versions a user can install, and they were reconciling it
 * differently: `unpublish:core` asked the registry before writing a range,
 * while `buddy new` did not ask at all. Split out so there is one answer to
 * "what is published" rather than one per caller.
 */

export interface PublishedVersions {
  /** The `latest` dist-tag, absent if the package has no releases. */
  latest?: string
  /** Every version the registry lists. */
  versions: Set<string>
}

/**
 * Ask the registry what exists for a package.
 *
 * Uses the abbreviated packument (`application/vnd.npm.install-v1+json`), which
 * is a fraction of the full document and carries the two things wanted here.
 * Throws on any non-OK response so callers can decide what an unreachable
 * registry means for them; it is not always fatal.
 */
export async function fetchPublishedVersions(depName: string): Promise<PublishedVersions> {
  const response = await fetch(`https://registry.npmjs.org/${depName.replace('/', '%2F')}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  })

  if (!response.ok)
    throw new Error(`registry responded ${response.status}`)

  const packument = await response.json() as {
    'dist-tags'?: Record<string, string>
    'versions'?: Record<string, unknown>
  }

  return {
    latest: packument['dist-tags']?.latest,
    versions: new Set(Object.keys(packument.versions ?? {})),
  }
}
