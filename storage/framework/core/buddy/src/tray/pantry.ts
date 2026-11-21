import { secrets } from 'bun'
import { bundledPackageCatalog, createPackageCatalogSearch } from 'ts-pantry/catalog'
import { PantryDesktopClient, PantryDesktopError } from 'ts-pantry/desktop'

const credential = { service: 'com.stacksjs.buddy.tray', name: 'Pantry Desktop' }

export function createTrayPantry() {
  let connection: Promise<string | null> | undefined
  let search: ReturnType<typeof createPackageCatalogSearch> | undefined
  const client = (token?: string) => new PantryDesktopClient({
    token,
    fetch: (url, init) => fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(4_000) }),
  })
  const readToken = () => connection ??= secrets.get(credential).catch((error) => {
    connection = undefined
    throw error
  })

  async function connected() {
    const token = await readToken()
    if (!token)
      throw new PantryDesktopError('Pair Pantry with Buddy first.', 401)
    return client(token)
  }

  async function jobs(bridge: PantryDesktopClient) {
    const records = await bridge.jobs()
    return records.map(({ id, domain, status, operation, error }) => ({ id, domain, status, operation, error }))
  }

  return {
    async status() {
      try {
        const health = await client().health()
        const capabilities = Array.isArray(health.capabilities) ? health.capabilities : []
        if (!(await readToken()))
          return { state: 'pair' as const }
        const bridge = await connected()
        const [packages, recentJobs] = await Promise.all([bridge.installed(), jobs(bridge)])
        return { state: 'ready' as const, packages, jobs: recentJobs, removal: capabilities.includes('uninstall:user') }
      }
      catch (error) {
        if (error instanceof PantryDesktopError && error.status === 401)
          return { state: 'pair' as const }
        return { state: 'offline' as const, issue: error instanceof Error ? error.message : 'Pantry is unavailable.' }
      }
    },
    catalog(query: string) {
      search ??= createPackageCatalogSearch(bundledPackageCatalog())
      return search(query, { limit: 8 }).map(({ domain, name }) => ({ domain, name }))
    },
    async jobs() {
      return jobs(await connected())
    },
    async pair(code: string) {
      const bridge = client()
      const token = await bridge.pair(code, 'Buddy')
      try {
        await secrets.set({ ...credential, value: token })
        connection = Promise.resolve(token)
      }
      catch (error) {
        await client(token).disconnect().catch(() => {})
        throw error
      }
    },
    async change(operation: 'install' | 'uninstall', domain: string, requestId: string) {
      const bridge = await connected()
      const job = await (operation === 'install' ? bridge.install(domain, requestId) : bridge.uninstall(domain, requestId))
      return { id: job.id, domain: job.domain, status: job.status, operation: job.operation, error: job.error }
    },
    async disconnect() {
      const bridge = await connected()
      await bridge.disconnect()
      connection = Promise.resolve(null)
      await secrets.delete(credential)
    },
  }
}
