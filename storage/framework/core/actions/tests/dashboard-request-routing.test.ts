import { describe, expect, it } from 'bun:test'
import { shouldDelegateDashboardRequest } from '../src/dev/dashboard-request-routing'

describe('dashboard request routing', () => {
  it('delegates JSON and authentication routes to the Stacks router', () => {
    expect(shouldDelegateDashboardRequest('/api/dashboard/models', 'GET')).toBe(true)
    expect(shouldDelegateDashboardRequest('/auth/tokens', 'GET')).toBe(true)
    expect(shouldDelegateDashboardRequest('/me', 'GET')).toBe(true)
    expect(shouldDelegateDashboardRequest('/login', 'POST')).toBe(true)
  })

  it('keeps dashboard pages and development assets in the STX server', () => {
    expect(shouldDelegateDashboardRequest('/health', 'GET')).toBe(false)
    expect(shouldDelegateDashboardRequest('/auth/tokens', 'POST')).toBe(true)
    expect(shouldDelegateDashboardRequest('/api/config/app', 'GET')).toBe(false)
    expect(shouldDelegateDashboardRequest('/__deps/dashboard-icons.css', 'GET')).toBe(false)
  })
})
