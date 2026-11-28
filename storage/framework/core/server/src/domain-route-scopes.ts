import type { DomainRoutes } from '@stacksjs/types'

type CompileDomainRoutes = (domains: DomainRoutes) => readonly {
  pattern: string
  only?: readonly string[]
}[]

/** Refuse a configured scope when the selected stx runtime cannot compile it. */
export function assertScopedDomainRoutes(domains: DomainRoutes | undefined, compile: CompileDomainRoutes | undefined): void {
  if (!domains)
    return

  const scopedHosts = Object.keys(domains).filter((host) => {
    const target = domains[host]
    return typeof target === 'object' && target?.only !== undefined
  })
  if (scopedHosts.length === 0)
    return

  const routes = compile?.(domains) ?? []
  const unavailable = scopedHosts.filter((host) => {
    const normalizedHost = host.trim().toLowerCase().replace(/\.$/, '')
    const route = routes.find(route => route.pattern === normalizedHost)
    return !Array.isArray(route?.only)
  })
  if (unavailable.length > 0) {
    throw new Error(
      `Unable to compile read-only domain scopes from config/server.ts for ${unavailable.join(', ')}. `
      + 'Use a bun-plugin-stx release with scoped domain routes and verify the hostname configuration.',
    )
  }
}
