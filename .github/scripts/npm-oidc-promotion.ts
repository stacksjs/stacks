const repository = 'stacksjs/stacks'
const workflow = 'release.yml'
const npmRegistry = 'https://registry.npmjs.org'
const audience = 'npm:registry.npmjs.org'

interface PromotionPermissions {
  schemaVersion: 1
  repository: string
  workflow: string
  version: string
  packages: string[]
}

interface TrustConfiguration {
  type?: unknown
  claims?: { repository?: unknown, workflow_ref?: { file?: unknown }, environment?: unknown }
  permissions?: unknown
}

export async function recordPromotionPermissions(
  packages: readonly { name: string }[],
  version: string,
  readTrustConfigurations: (name: string) => Promise<unknown>,
): Promise<PromotionPermissions> {
  const missing: string[] = []
  for (const { name } of packages) {
    const configurations = await readTrustConfigurations(name)
    const allowed = Array.isArray(configurations) && configurations.some((configuration: TrustConfiguration | null) => {
      const claims = configuration?.claims
      return configuration?.type === 'github'
        && claims?.repository === repository
        && (claims.workflow_ref?.file === workflow || claims.workflow_ref?.file === `.github/workflows/${workflow}`)
        && (claims.environment === undefined || claims.environment === null || claims.environment === '')
        && Array.isArray(configuration.permissions)
        && configuration.permissions.includes('createPackage')
        && configuration.permissions.includes('manageDistTags')
    })
    if (!allowed) missing.push(name)
  }
  if (missing.length) throw new Error(`npm ${workflow} publisher must grant createPackage and manageDistTags for ${missing.join(', ')}`)
  return { schemaVersion: 1, repository, workflow, version, packages: packages.map(pkg => pkg.name).sort() }
}

export function validatePromotionPermissions(raw: string, packages: readonly { name: string }[], version: string): void {
  let receipt: Partial<PromotionPermissions> | null
  try { receipt = JSON.parse(raw) }
  catch { throw new Error('RELEASE_NPM_OIDC_PERMISSIONS must contain the npm permission audit JSON') }
  if (receipt?.schemaVersion !== 1 || receipt.repository !== repository || receipt.workflow !== workflow || receipt.version !== version)
    throw new Error(`RELEASE_NPM_OIDC_PERMISSIONS must match ${repository}, ${workflow} and release ${version}`)
  const expected = packages.map(pkg => pkg.name).sort()
  if (!expected.length || !Array.isArray(receipt.packages) || receipt.packages.length !== expected.length
    || receipt.packages.some(name => typeof name !== 'string')
    || !receipt.packages.toSorted().every((name, index) => name === expected[index]))
    throw new Error('RELEASE_NPM_OIDC_PERMISSIONS must match the complete scoped release package set')
}

function isToken(value: unknown): value is string {
  return typeof value === 'string' && /^[\x21-\x7E]{1,8192}$/.test(value)
}

async function requestToken<T>(url: URL, method: 'GET' | 'POST', token: string, source: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    })
  }
  catch { throw new Error(`${source} request failed`) }
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`${source} returned HTTP ${response.status}`)
  }
  try { return await response.json() as T }
  catch { throw new Error(`${source} returned an invalid token response`) }
}

export async function exchangePromotionToken(
  name: string,
  requestUrl: URL,
  requestTokenValue: string,
  registry = new URL(npmRegistry),
): Promise<string> {
  const fixture = registry.protocol === 'http:' && registry.hostname === '127.0.0.1'
  if ((!fixture && registry.origin !== npmRegistry) || registry.username || registry.password || registry.pathname !== '/' || registry.search || registry.hash)
    throw new Error('OIDC token exchange requires the public npm registry or an owned loopback fixture')
  const githubActions = requestUrl.protocol === 'https:' && !requestUrl.port && requestUrl.hostname.endsWith('.actions.githubusercontent.com')
  if (!(fixture ? requestUrl.origin === registry.origin : githubActions) || requestUrl.username || requestUrl.password || requestUrl.hash)
    throw new Error('Invalid GitHub Actions identity endpoint')
  if (!isToken(requestTokenValue)) throw new Error('Invalid GitHub Actions identity request credential')

  const identityUrl = new URL(requestUrl)
  identityUrl.searchParams.set('audience', audience)
  const identity = await requestToken<{ value?: unknown } | null>(identityUrl, 'GET', requestTokenValue, 'GitHub Actions identity endpoint')
  if (!isToken(identity?.value)) throw new Error('GitHub Actions identity endpoint returned an invalid token response')

  const exchangeUrl = new URL(`/-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(name)}`, registry)
  const exchanged = await requestToken<{ token_type?: unknown, token?: unknown, expires?: string } | null>(exchangeUrl, 'POST', identity.value, `npm OIDC exchange for ${name}`)
  if (exchanged?.token_type !== 'oidc' || !isToken(exchanged.token) || typeof exchanged.expires !== 'string' || !(Date.parse(exchanged.expires) > Date.now()))
    throw new Error(`npm OIDC exchange for ${name} returned an invalid or expired token`)
  return exchanged.token
}
