/**
 * Where the framework's own packages are read from: the Pantry registry
 * first, npm when Pantry cannot answer.
 *
 * Framework releases publish to Pantry by default and to npm only when a
 * project opts in (`.github/scripts/release-registries.ts`). Pantry's
 * `/npm/` endpoint speaks npm's registry protocol and merges in the versions
 * only npm holds, so one read there sees every release from either registry.
 * npm stays the fallback for a Pantry outage, and for the window before
 * Pantry serves the endpoint at all.
 *
 * `STACKS_FRAMEWORK_REGISTRY` overrides the first registry; `npm` reads npm
 * alone.
 */
import process from 'node:process'

export const NPM_REGISTRY = 'https://registry.npmjs.org'
export const PANTRY_NPM_REGISTRY = 'https://registry.pantry.dev/npm'

/** The registry framework reads try first, before falling back to npm. */
export function frameworkRegistry(env: Record<string, string | undefined> = process.env): string | null {
  const configured = env.STACKS_FRAMEWORK_REGISTRY?.trim()
  if (!configured) return PANTRY_NPM_REGISTRY
  if (configured === 'npm' || configured.replace(/\/$/, '') === NPM_REGISTRY) return null
  return configured.replace(/\/$/, '')
}

type Read = (url: string, init?: RequestInit) => Promise<Response>

/**
 * A fetch for npm-protocol reads (`https://registry.npmjs.org/<name>[/<version>]`)
 * that asks the framework registry first and npm only when it cannot answer:
 * a network failure or any non-2xx. Other URLs pass straight through.
 */
export function frameworkRegistryFetch(read: Read = fetch, env: Record<string, string | undefined> = process.env): typeof fetch {
  const first = frameworkRegistry(env)
  const fetchFramework: Read = async (url, init) => {
    if (!first || !url.startsWith(`${NPM_REGISTRY}/`)) return read(url, init)
    // try/await rather than .catch(): a fetch can also throw before it
    // returns a promise, and that must fall back the same way.
    try {
      const response = await read(`${first}${url.slice(NPM_REGISTRY.length)}`, init)
      if (response.ok) return response
    }
    catch {}
    return read(url, init)
  }
  return fetchFramework as typeof fetch
}
