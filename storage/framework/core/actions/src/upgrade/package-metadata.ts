import { frameworkRegistryFetch, NPM_REGISTRY } from '../framework-registry'

interface PackageManifest {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

interface ReleaseList {
  versions: Set<string>
  latest?: string
}

export interface PackageMetadata {
  manifest: (name: string, selector: string) => Promise<PackageManifest | null>
  releases: (name: string) => Promise<ReleaseList>
}

/** Read the registries that the project's subsequent Bun install will use. */
export function bunPackageMetadata(cwd: string): PackageMetadata {
  async function info<T>(name: string, field?: string): Promise<T | null> {
    const child = Bun.spawn(['bun', 'info', '--json', '--no-cache', name, ...field ? [field] : []], {
      cwd,
      stdout: 'pipe',
      stderr: 'ignore',
      timeout: 30_000,
    })
    const [output, code] = await Promise.all([new Response(child.stdout).text(), child.exited])
    if (code !== 0) return null
    try { return JSON.parse(output) as T }
    catch { return null }
  }

  return {
    async manifest(name, selector) {
      // Resolve tags explicitly because older Bun releases used latest when
      // an unrecognized tag was passed with the package name.
      const version = selector === 'latest' || selector === 'canary'
        ? (await info<Record<string, string>>(name, 'dist-tags'))?.[selector]
        : selector
      return version ? info<PackageManifest>(`${name}@${version}`) : null
    },
    async releases(name) {
      // Older Bun versions accept one metadata field per invocation.
      const [versions, tags] = await Promise.all([
        info<string[]>(name, 'versions'),
        info<Record<string, string>>(name, 'dist-tags'),
      ])
      if (!Array.isArray(versions)) throw new TypeError(`Could not list the published releases of ${name} through Bun.`)
      return { versions: new Set(versions), latest: tags?.latest }
    },
  }
}

/** Framework source upgrades retain the framework registry transport. */
export function frameworkPackageMetadata(read: typeof fetch = frameworkRegistryFetch()): PackageMetadata {
  const url = (name: string) => `${NPM_REGISTRY}/${name.replace('/', '%2f')}`
  return {
    async manifest(name, selector) {
      const response = await read(`${url(name)}/${selector}`).catch(() => null)
      return response?.ok ? response.json().catch(() => null) : null
    },
    async releases(name) {
      const response = await read(url(name), { headers: { accept: 'application/vnd.npm.install-v1+json' } })
      if (!response.ok) throw new Error(`Could not list the published releases of ${name}.`)
      const metadata = await response.json() as { 'versions'?: Record<string, unknown>, 'dist-tags'?: Record<string, string> }
      return { versions: new Set(Object.keys(metadata.versions ?? {})), latest: metadata['dist-tags']?.latest }
    },
  }
}
