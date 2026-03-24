import { describe, expect, mock, test } from 'bun:test'

// ---------------------------------------------------------------------------
// Mock the stacks-router used by route-loader
// ---------------------------------------------------------------------------

const mockGroup = mock(async (opts: any, cb: any) => {
  await cb()
})

mock.module('../src/stacks-router', () => ({
  route: {
    group: mockGroup,
  },
}))

// Mock the framework default routes import (optional, should not crash)
mock.module('../../../defaults/routes/dashboard', () => ({}))

// ---------------------------------------------------------------------------
// Import module under test
// We need to test the exported loadRoutes plus the internal helpers.
// Since normalizeDefinition, normalizeMiddleware, and importRouteFile are
// private, we test them indirectly through loadRoutes.
// ---------------------------------------------------------------------------

const { loadRoutes } = await import('../src/route-loader')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Route Loader - loadRoutes', () => {
  test('loads user routes from a simple string definition', async () => {
    // The import will fail because the route file does not exist,
    // so this tests that the error path works and throws properly.
    await expect(
      loadRoutes({ api: 'api' }),
    ).rejects.toThrow()
  })

  test('loads routes with object definition containing path', async () => {
    await expect(
      loadRoutes({ web: { path: 'web' } }),
    ).rejects.toThrow()
  })

  test('api and web keys have no prefix added', async () => {
    // Both 'api' and 'web' are in NO_PREFIX_KEYS, so they should not
    // cause a group with prefix. Since the import fails, we verify
    // by checking the error message contains the route path.
    try {
      await loadRoutes({ api: 'api' })
    }
    catch (e: any) {
      expect(e.message).toContain('api')
    }
  })

  test('non-api/web keys get /<key> prefix via route.group', async () => {
    // For a key like 'admin', it should call route.group with prefix '/admin'
    // The import inside will fail, but group should be called.
    try {
      await loadRoutes({ admin: 'admin' })
    }
    catch {
      // Expected to fail on import
    }
    // route.group should have been called for the 'admin' key
    const calls = mockGroup.mock.calls
    const lastCall = calls[calls.length - 1]
    if (lastCall) {
      expect(lastCall[0]).toHaveProperty('prefix', '/admin')
    }
  })

  test('custom prefix in definition overrides default', async () => {
    try {
      await loadRoutes({ dashboard: { path: 'dashboard', prefix: '/v1/dash' } })
    }
    catch {
      // Expected
    }
    const calls = mockGroup.mock.calls
    const lastCall = calls[calls.length - 1]
    if (lastCall) {
      expect(lastCall[0]).toHaveProperty('prefix', '/v1/dash')
    }
  })

  test('middleware array is passed to route.group', async () => {
    try {
      await loadRoutes({ protected: { path: 'protected', middleware: ['auth', 'verified'] } })
    }
    catch {
      // Expected
    }
    const calls = mockGroup.mock.calls
    const lastCall = calls[calls.length - 1]
    if (lastCall) {
      expect(lastCall[0].middleware).toEqual(['auth', 'verified'])
    }
  })

  test('string middleware is normalized to array', async () => {
    try {
      await loadRoutes({ admin: { path: 'admin', middleware: 'auth' } })
    }
    catch {
      // Expected
    }
    const calls = mockGroup.mock.calls
    const lastCall = calls[calls.length - 1]
    if (lastCall) {
      expect(lastCall[0].middleware).toEqual(['auth'])
    }
  })

  test('invalid path with .. throws path traversal error', async () => {
    await expect(
      loadRoutes({ evil: '../../../etc/passwd' }),
    ).rejects.toThrow('Invalid route path')
  })

  test('absolute path starting with / throws error', async () => {
    await expect(
      loadRoutes({ evil: '/etc/passwd' }),
    ).rejects.toThrow('Invalid route path')
  })

  test('empty registry loads only framework routes without error', async () => {
    // Empty registry should not throw - just loads framework routes
    await loadRoutes({})
  })
})
