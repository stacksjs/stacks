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
export type DashboardProxyStrategy = 'parent-managed' | 'daemon-route' | 'own-proxy' | 'origin-only'

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
