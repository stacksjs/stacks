/**
 * How `dashboard.<domain>` gets served in development.
 *
 * - `parent-managed`: `buddy dev` started us and already owns rpx, TLS and the
 *   :443 daemon. A second proxy here would fight it for the port and break
 *   routing for the other hosts (app, docs, api).
 * - `daemon-route`: a shared rpx daemon is already serving :443, so publishing a
 *   registry route is both sufficient and all an unprivileged process can do.
 *   Starting an in-process proxy instead could not bind :443, and rpx would
 *   settle on some high port that the pretty URL never reaches.
 * - `own-proxy`: nothing holds :443, so this process runs the proxy itself.
 * - `origin-only`: no custom domain configured; `http://localhost:<port>` is the
 *   only URL there is.
 */
import { lookup } from 'node:dns/promises'
import { connect, isIP } from 'node:net'
import process from 'node:process'
import { getCACertificates } from 'node:tls'

export type DashboardProxyStrategy = 'parent-managed' | 'daemon-route' | 'own-proxy' | 'origin-only'

/**
 * `dashboard.<host>` for APP_URL's host, or null when the dashboard is only
 * served on localhost: no custom host, or `localhostOnly`, which is
 * `STACKS_DEV_LOCALHOST=1`, the opt-out `buddy dev` already honours. Without
 * it a standalone `buddy dev:dashboard` asked for sudo before it would serve,
 * even when told to stay on localhost.
 */
export function resolveDashboardDomain(appUrl: string, localhostOnly = false, dashboardUrl?: string): string | null {
  const override = dashboardUrl?.trim()
  if (localhostOnly || !(override || appUrl).trim())
    return null
  try {
    const value = (override || appUrl).trim()
    if (!value.includes('://') && /^[a-z][a-z0-9+.-]*:(?!\d+(?:[/?#]|$))/i.test(value))
      return null
    const url = new URL(value.includes('://') ? value : `http://${value}`)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return null
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
    // URL keeps IPv6 brackets and canonicalizes abbreviated IPv4 addresses.
    // Neither is a DNS base to which a dashboard subdomain can be attached.
    if (hostname === 'localhost' || isIP(hostname.replace(/^\[|\]$/g, '')))
      return null
    if (!hostname || !hostname.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))
      return null
    if (override && (url.port || url.pathname !== '/' || url.search || url.hash))
      return null
    return override ? hostname : `dashboard.${hostname}`
  }
  catch {
    return null
  }
}

export const dashboardReadyPath = '/__buddy/dashboard-ready'
export const dashboardReadyHeader = 'x-stacks-dashboard'
export const dashboardPendingHeader = 'x-stacks-dashboard-pending'

export function dashboardOriginUrl(domain: string | null, port: number): string {
  return `http://${domain?.endsWith('.localhost') ? domain : '127.0.0.1'}:${port}`
}

/** Only advertise a route that serves this dashboard through trusted HTTPS. */
export async function dashboardHttpsAnswers(domain: string, instance: string): Promise<boolean> {
  try {
    if (!domain.endsWith('.localhost')) {
      const addresses = await Promise.race([lookup(domain, { all: true }), Bun.sleep(350).then(() => [])])
      if (!addresses.length || addresses.some(({ address }) => address !== '::1' && !/^(?:::ffff:)?127\./.test(address)))
        return false
    }
    const ca = [...getCACertificates('default'), ...getCACertificates('system')]
    // The registry watcher can pick the new route up just after the origin listens.
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`https://${domain}${dashboardReadyPath}`, {
        method: 'HEAD',
        redirect: 'error',
        signal: AbortSignal.timeout(350),
        tls: { ca },
      }).catch(() => null)
      if (response?.ok && response.headers.get(dashboardReadyHeader) === instance)
        return true
      if (attempt === 0)
        await Bun.sleep(125)
    }
    return false
  }
  catch {
    return false
  }
}

export interface DashboardProxyProbes {
  /** `buddy dev` sets STACKS_PROXY_MANAGED before spawning the dashboard. */
  proxyManagedExternally: boolean
  /** Whether rpx's pid file points at a live daemon. */
  isDaemonRunning: () => Promise<boolean>
  /** Whether anything actually answers on :443 - a live pid file is not proof. */
  httpsPortAnswers: () => Promise<boolean>
}

export async function resolveDashboardProxyStrategy(
  dashboardDomain: string | null,
  probes: DashboardProxyProbes,
): Promise<DashboardProxyStrategy> {
  if (!dashboardDomain)
    return 'origin-only'

  if (probes.proxyManagedExternally)
    return 'parent-managed'

  // A daemon that registered a pid but never elevated leaves :443 unbound, and
  // handing it a route would publish a URL nothing serves. Both have to hold.
  if (await probes.isDaemonRunning() && await probes.httpsPortAnswers())
    return 'daemon-route'

  return 'own-proxy'
}

/** Whether anything is listening on `port` of the loopback interface. */
function portAnswers(port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' })
    const finish = (answered: boolean): void => {
      try { socket.destroy() }
      catch { /* already gone */ }
      resolve(answered)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    setTimeout(() => finish(false), timeoutMs).unref?.()
  })
}

/**
 * Publish `dashboard.<domain>` on the shared rpx daemon.
 *
 * The daemon is root-owned and already holds :443 for every dev host, so a
 * route is all this process can (and needs to) contribute. The entry carries
 * this pid, which is how the daemon garbage-collects it when the dashboard
 * stops.
 */
async function registerWithRpxDaemon(domainToServe: string, dashboardAddress: string, pid: number, verbose: boolean): Promise<boolean> {
  const { writeEntry } = await import('@stacksjs/rpx')

  await writeEntry({
    id: `${domainToServe}-dashboard`,
    from: dashboardAddress,
    to: domainToServe,
    cwd: process.cwd(),
    createdAt: new Date().toISOString(),
    pid,
  }, undefined, verbose)

  return true
}

/**
 * Make `https://dashboard.<domain>` reach this server. Returns whether the
 * pretty URL is actually served - see {@link resolveDashboardProxyStrategy}
 * for the cases.
 */
export async function startDashboardReverseProxy(options: {
  domain: string | null
  address: string
  pid: number
  verbose: boolean
}): Promise<boolean> {
  const { domain: dashboardDomain, address: dashboardAddress, pid, verbose } = options
  const sslBasePath = `${process.env.HOME}/.stacks/ssl`
  const background = process.env.STACKS_DASHBOARD_BACKGROUND === '1'
  if (!dashboardDomain) return false

  try {
    // Loaded lazily: under `buddy dev` the strategy is settled without touching
    // rpx at all, and importing it there only costs boot time and log noise.
    let rpx: typeof import('@stacksjs/rpx') | undefined
    const loadRpx = async (): Promise<typeof import('@stacksjs/rpx')> => (rpx ??= await import('@stacksjs/rpx'))

    const strategy = await resolveDashboardProxyStrategy(dashboardDomain, {
      proxyManagedExternally: Boolean(process.env.STACKS_PROXY_MANAGED),
      isDaemonRunning: async () => (await loadRpx()).isDaemonRunning(),
      httpsPortAnswers: () => portAnswers(443),
    })

    if (strategy === 'origin-only')
      return false

    // `buddy dev` owns the proxy and publishes its routes when the ports are ready.
    if (strategy === 'parent-managed')
      return true

    if (strategy === 'daemon-route') {
      await registerWithRpxDaemon(dashboardDomain, dashboardAddress, pid, verbose)
      return true
    }

    if (background)
      return false

    await (await loadRpx()).startProxies({
      proxies: [
        { from: dashboardAddress, to: dashboardDomain, cleanUrls: false },
      ],
      https: {
        basePath: sslBasePath,
        validityDays: 825,
      },
      regenerateUntrustedCerts: false,
      verbose,
    })

    // rpx falls back to a high port when it cannot bind :443 (it needs root),
    // and that fallback port is not in the pretty URL. Only claim the pretty
    // URL once :443 actually answers; otherwise the banner below prints the
    // origin URL, which always works.
    return await portAnswers(443)
  }
  catch (error) {
    if (verbose) console.log(`  Proxy: ${error}`)
    return false
  }
}
