import { launch, type LaunchedChrome } from '@stacksjs/testing/browser'

/** Open WebViews inside the same isolated browser launcher that runs browser tests. */
export function captureBrowser(backend: 'webkit' | 'chrome') {
  let chrome: LaunchedChrome | undefined
  let endpoint: string | undefined
  return {
    async view(width: number, height: number): Promise<Bun.WebView> {
      if (typeof Bun.WebView !== 'function') throw new Error('This Bun has no WebView. Upgrade Bun before capturing screens.')
      if (backend === 'webkit') return new Bun.WebView({ width, height, backend })
      if (!endpoint) {
        const owned = await launch({ shared: false, quietLiveReload: false, chromePath: process.env.BUN_CHROME_PATH || undefined })
        try {
          const address = `127.0.0.1:${owned.port}`
          const response = await fetch(`http://${address}/json/version`, { signal: AbortSignal.timeout(5_000) })
          if (!response.ok) throw new Error(`Could not read Chrome’s DevTools endpoint (HTTP ${response.status})`)
          const version = await response.json() as { webSocketDebuggerUrl?: string }
          const url = URL.parse(version.webSocketDebuggerUrl || '')
          if (url?.protocol !== 'ws:' || url.host !== address || !url.pathname.startsWith('/devtools/browser/'))
            throw new Error('Chrome did not return its own loopback DevTools endpoint')
          endpoint = url.href
          chrome = owned
        }
        catch (error) {
          await owned.close()
          throw error
        }
      }
      return new Bun.WebView({ width, height, backend: { type: 'chrome', url: endpoint } })
    },
    async close(): Promise<void> {
      try { await chrome?.close() }
      finally { chrome = undefined; endpoint = undefined }
    },
  }
}
