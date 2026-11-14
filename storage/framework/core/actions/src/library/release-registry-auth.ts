/** Input-only registry credential. Never store it in release data or receipts. */
export interface LibraryRegistryReadAuth {
  registry: string
  token: string
}
export interface LibraryRegistryReadAuthOptions {
  npmRegistry?: string
  readAuth?: LibraryRegistryReadAuth
}
export const NPM_REGISTRY_ORIGIN = 'https://registry.npmjs.org'

export function libraryRegistryOrigin(registry: string = NPM_REGISTRY_ORIGIN): string {
  let url: URL
  try { url = new URL(registry) }
  catch { throw new Error('Expected a plain HTTPS npm registry origin') }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/'
    || url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    throw new Error('Expected a plain HTTPS npm registry origin')
  return url.origin
}

function validateAuth(options: LibraryRegistryReadAuthOptions): LibraryRegistryReadAuth | undefined {
  const registry = libraryRegistryOrigin(options.npmRegistry)
  if (options.readAuth === undefined) return undefined
  const auth = options.readAuth
  if (!auth || typeof auth.registry !== 'string' || libraryRegistryOrigin(auth.registry) !== registry)
    throw new Error('Registry read credentials must match the exact configured registry origin')
  // Bearer credentials use RFC 6750 b64token syntax. Reject malformed inputs
  // before fetch constructs a header or a retry can obscure the configuration error.
  if (typeof auth.token !== 'string' || !/^[A-Za-z0-9._~+/-]+=*$/.test(auth.token))
    throw new Error('Expected a nonempty valid registry read credential')
  return { registry, token: auth.token }
}

/** Resolve standard CLI credentials only for npmjs, never for an overridden origin. */
export function resolveLibraryRegistryReadAuth(options: LibraryRegistryReadAuthOptions, environment: Record<string, string | undefined>): LibraryRegistryReadAuth | undefined {
  const explicit = validateAuth(options)
  if (explicit) return explicit
  const registry = libraryRegistryOrigin(options.npmRegistry)
  if (registry !== NPM_REGISTRY_ORIGIN) return undefined
  const token = environment.NPM_READ_TOKEN || environment.NODE_AUTH_TOKEN
  return !token ? undefined : validateAuth({ npmRegistry: registry, readAuth: { registry, token } })
}

/** Headers are used only after exact-origin validation; registry reads forbid redirects. */
export function libraryRegistryReadHeaders(options: LibraryRegistryReadAuthOptions, restricted: boolean = false): Record<string, string> | undefined {
  const auth = validateAuth(options)
  if (restricted && !auth) throw new Error('Restricted packages require an explicit scoped registry read credential before publication or readback')
  return auth ? { Authorization: `Bearer ${auth.token}` } : undefined
}
