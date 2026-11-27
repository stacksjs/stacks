import type { DashboardProxyProbes } from '../src/dev/dashboard-proxy'
import { describe, expect, it } from 'bun:test'
import { dashboardOriginUrl, resolveDashboardDomain, resolveDashboardProxyStrategy } from '../src/dev/dashboard-proxy'

function probes(overrides: Partial<DashboardProxyProbes> = {}): DashboardProxyProbes {
  return {
    proxyManagedExternally: false,
    isDaemonRunning: async () => false,
    httpsPortAnswers: async () => false,
    ...overrides,
  }
}

describe('dashboard proxy strategy', () => {
  it('honors an explicit dashboard host and only uses loopback on a direct origin', () => {
    expect(resolveDashboardDomain('attic.localhost', false, 'https://attic.test')).toBe('attic.test')
    expect(resolveDashboardDomain('attic.localhost', false, '  ')).toBe('dashboard.attic.localhost')
    expect(resolveDashboardDomain('attic.localhost', true, 'https://attic.test')).toBeNull()
    expect(resolveDashboardDomain('attic.localhost', false, 'https://attic.test:9443')).toBeNull()
    expect(dashboardOriginUrl('dashboard.attic.localhost', 3901)).toBe('http://dashboard.attic.localhost:3901')
    expect(dashboardOriginUrl('attic.test', 3901)).toBe('http://127.0.0.1:3901')
  })
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

  it('stays on localhost when told to, whatever APP_URL names', async () => {
    const domain = resolveDashboardDomain('https://stacks.localhost', true)
    expect(domain).toBeNull()
    const unexpected = async (): Promise<boolean> => { throw new Error('must not probe the system') }
    expect(await resolveDashboardProxyStrategy(domain, probes({ isDaemonRunning: unexpected, httpsPortAnswers: unexpected }))).toBe('origin-only')
  })

  it('serves the origin URL only when no custom domain is configured', async () => {
    expect(await resolveDashboardProxyStrategy(null, probes())).toBe('origin-only')
  })

  it('leaves the proxy to `buddy dev` without probing when it is the parent', async () => {
    const unexpected = async (): Promise<boolean> => { throw new Error('must not probe the system') }
    const strategy = await resolveDashboardProxyStrategy('dashboard.stacks.localhost', probes({
      proxyManagedExternally: true,
      isDaemonRunning: unexpected,
      httpsPortAnswers: unexpected,
    }))
    expect(strategy).toBe('parent-managed')
  })

  it('publishes a route when a daemon is already serving :443', async () => {
    const strategy = await resolveDashboardProxyStrategy('dashboard.stacks.localhost', probes({
      isDaemonRunning: async () => true,
      httpsPortAnswers: async () => true,
    }))
    expect(strategy).toBe('daemon-route')
  })

  // A pid file outlives a daemon that never managed to elevate and bind :443.
  it('keeps the origin available when the daemon pid is live but :443 is silent', async () => {
    const strategy = await resolveDashboardProxyStrategy('dashboard.stacks.localhost', probes({
      isDaemonRunning: async () => true,
      httpsPortAnswers: async () => false,
    }))
    expect(strategy).toBe('origin-only')
  })

  it('leaves privileged setup to `buddy setup:ssl` when no daemon is running', async () => {
    const unexpected = async (): Promise<boolean> => { throw new Error('must not probe HTTPS without a daemon') }
    const strategy = await resolveDashboardProxyStrategy('dashboard.stacks.localhost', probes({ httpsPortAnswers: unexpected }))
    expect(strategy).toBe('origin-only')
  })
})
