interface MobileBuildTarget {
  renderer?: 'web' | 'native'
  site?: string
  nativeBundle?: string
  webAssets?: string
  fallbackWebAssets?: string
  /**
   * A production build. Anything else is a development build, where a site
   * that is not local is usually an accident (stacksjs/stacks#2942).
   */
  production?: boolean
}

/**
 * Whether a site is the developer's own machine or network: loopback, the
 * Android emulator's alias for the host, a `.localhost` or `.test` name, or a
 * private address a physical device reaches the laptop on.
 */
export function isLocalSite(site: URL): boolean {
  const host = site.hostname.replace(/^\[|\]$/g, '')
  if (['localhost', '127.0.0.1', '::1', '10.0.2.2'].includes(host))
    return true
  if (host.endsWith('.localhost') || host.endsWith('.test') || host.endsWith('.local'))
    return true
  const octets = host.split('.').map(Number)
  if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet)))
    return false
  const [a, b] = octets as [number, number, number, number]
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)
}

/** Describe the resolved build inputs, never credentials embedded in a URL. */
export function reportMobileBuildTarget(target: MobileBuildTarget, log: { info: (message: string) => unknown, warn: (message: string) => unknown }): void {
  const site = target.site ? new URL(target.site) : undefined
  if (site) {
    site.username = ''
    site.password = ''
    site.search = ''
    site.hash = ''
  }
  if (target.renderer === 'native') {
    log.info(`Native screens: ${target.nativeBundle}`)
    if (site) log.info(`API site: ${site}`)
  }
  else if (target.webAssets) {
    log.info(`Bundled web source: ${target.webAssets}`)
  }
  else {
    if (site) log.info(`Web source: ${site}`)
    if (target.fallbackWebAssets) log.info(`Offline web fallback: ${target.fallbackWebAssets}`)
  }

  // A development build pointed at a live site signs testers in to real
  // accounts and writes real data, from a build everyone believes is local.
  // A warning rather than a refusal: reproducing a production-only bug from a
  // debug build is legitimate, it just has to be a choice (stacksjs/stacks#2942).
  if (site && !target.production && !isLocalSite(site) && (target.renderer === 'native' || !target.webAssets))
    log.warn(`This development build talks to ${site}, which is not a local server. To build against your dev server, point the app's url in config/mobile.ts at it (for example http://localhost:3000). Build with NODE_ENV=production for a release.`)
}
