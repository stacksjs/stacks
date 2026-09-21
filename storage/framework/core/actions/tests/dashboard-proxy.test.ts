import type { DashboardProxyProbes } from '../src/dev/dashboard-proxy'
import { describe, expect, it } from 'bun:test'
import { resolveDashboardProxyStrategy } from '../src/dev/dashboard-proxy'

function probes(overrides: Partial<DashboardProxyProbes> = {}): DashboardProxyProbes {
  return {
    proxyManagedExternally: false,
    isDaemonRunning: async () => false,
    httpsPortAnswers: async () => false,
    ...overrides,
  }
}

describe('dashboard proxy strategy', () => {
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
