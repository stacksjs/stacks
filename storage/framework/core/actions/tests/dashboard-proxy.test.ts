import type { DashboardProxyProbes } from '../src/dev/dashboard-proxy'
import { describe, expect, it } from 'bun:test'
import { resolveDashboardDomain, resolveDashboardProxyStrategy } from '../src/dev/dashboard-proxy'

function probes(overrides: Partial<DashboardProxyProbes> = {}): DashboardProxyProbes {
  return {
    proxyManagedExternally: false,
    isDaemonRunning: async () => false,
    httpsPortAnswers: async () => false,
    ...overrides,
  }
}

describe('dashboard proxy strategy', () => {
  it.each([
    '', 'localhost', 'localhost:4320', 'http://localhost', 'https://LOCALHOST.:4320/path',
    'http://127.0.0.1:4320', '127.0.0.2:4320', '127.1', '0.0.0.0:4320',
    'http://192.168.1.10:4320', 'http://[::1]:4320', 'http://[::]:4320',
    'http://[2001:db8::1]:4320', 'not a url', 'file:///tmp/app', 'https://user:pass@app.test',
    'http:/localhost:4320', 'https:localhost:4320', 'ftp:app.test',
  ])('never starts proxy or certificate probes for local, IP or invalid URL %s', async (appUrl) => {
    const domain = resolveDashboardDomain(appUrl)
    expect(domain).toBeNull()
    const unexpected = async (): Promise<boolean> => { throw new Error('must not probe the system') }
    expect(await resolveDashboardProxyStrategy(domain, probes({ isDaemonRunning: unexpected, httpsPortAnswers: unexpected }))).toBe('origin-only')
  })

  it.each([
    ['stacks.localhost', 'dashboard.stacks.localhost'],
    ['https://App.Example:4320/path?query=1#fragment', 'dashboard.app.example'],
    ['app.test:4320/path', 'dashboard.app.test'],
  ])('uses only the DNS hostname from %s', (appUrl, expected) => {
    expect(resolveDashboardDomain(appUrl)).toBe(expected)
  })

  it('serves the origin URL only when no custom domain is configured', async () => {
    expect(await resolveDashboardProxyStrategy(null, probes())).toBe('origin-only')
  })

  it('leaves the proxy to `buddy dev` when it is the parent', async () => {
    const strategy = await resolveDashboardProxyStrategy('dashboard.stacks.localhost', probes({
      proxyManagedExternally: true,
      isDaemonRunning: async () => true,
      httpsPortAnswers: async () => true,
    }))
    expect(strategy).toBe('parent-managed')
  })

  // The in-process proxy cannot take :443 off a daemon that already holds it;
  // rpx would fall back to a high port the pretty URL never reaches.
  it('publishes a route when a daemon is already serving :443', async () => {
    const strategy = await resolveDashboardProxyStrategy('dashboard.stacks.localhost', probes({
      isDaemonRunning: async () => true,
      httpsPortAnswers: async () => true,
    }))
    expect(strategy).toBe('daemon-route')
  })

  // A pid file outlives a daemon that never managed to elevate and bind :443.
  it('runs its own proxy when the daemon pid is live but :443 is silent', async () => {
    const strategy = await resolveDashboardProxyStrategy('dashboard.stacks.localhost', probes({
      isDaemonRunning: async () => true,
      httpsPortAnswers: async () => false,
    }))
    expect(strategy).toBe('own-proxy')
  })

  it('runs its own proxy when no daemon is running', async () => {
    const strategy = await resolveDashboardProxyStrategy('dashboard.stacks.localhost', probes())
    expect(strategy).toBe('own-proxy')
  })
})
