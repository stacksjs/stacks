interface MobileBuildTarget {
  renderer?: 'web' | 'native'
  site?: string
  nativeBundle?: string
  webAssets?: string
  fallbackWebAssets?: string
}

/** Describe the resolved build inputs, never credentials embedded in a URL. */
export function reportMobileBuildTarget(target: MobileBuildTarget, log: { info: (message: string) => unknown }): void {
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
}
