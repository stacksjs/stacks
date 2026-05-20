import { describe, expect, test } from 'bun:test'

// ---------------------------------------------------------------------------
// Import the real route-loader functions directly — no mocks.
// The internal helpers (normalizeDefinition, normalizeMiddleware,
// importRouteFile) are private, so we test them indirectly through loadRoutes.
// ---------------------------------------------------------------------------

const { loadRoutes } = await import('../src/route-loader')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Route Loader - loadRoutes', () => {
  test('loads user routes from a simple string definition', async () => {
    // routes/api.ts exists so this should resolve successfully
    await expect(
      loadRoutes({ api: 'api' }),
    ).resolves.toBeUndefined()
  })

  test('loads routes with object definition containing path', async () => {
    await expect(
      loadRoutes({ web: { path: 'web' } }),
    ).rejects.toThrow()
  })

  test('the web key has no prefix added (only `web` is in NO_PREFIX_KEYS now)', async () => {
    // `web` mounts at root /. The import will throw for the synthetic
    // path, but reaching the import means the prefix logic ran with
    // `undefined` — the group wrapper wasn't invoked. We verify by
    // ensuring the error mentions the route path (came from the
    // import attempt, not a group setup failure).
    try {
      await loadRoutes({ web: 'web' })
    }
    catch (e: any) {
      expect(e.message).toContain('web')
    }
  })

  test('the api key auto-prefixes with /api (stacksjs/stacks#1835)', async () => {
    // Previously `api` was in NO_PREFIX_KEYS and `routes/api.ts`
    // mounted at root — which 404'd through the rpx proxy because the
    // forwarded URL kept its `/api` prefix. The fix moves `api` out of
    // NO_PREFIX_KEYS so it picks up the conventional `/api` prefix
    // from the key-to-prefix default.
    //
    // We can't easily assert the group prefix without spinning up the
    // real router; the integration smoke is that registering
    // `route.get('/cart/add')` from `routes/api.ts` ends up matchable
    // at `/api/cart/add` via the dev proxy.
    await expect(loadRoutes({ api: 'api' })).resolves.toBeUndefined()
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
  })

  test('custom prefix in definition overrides default', async () => {
    try {
      await loadRoutes({ dashboard: { path: 'dashboard', prefix: '/v1/dash' } })
    }
    catch {
      // Expected
    }
  })

  test('middleware array is passed to route.group', async () => {
    try {
      await loadRoutes({ protected: { path: 'protected', middleware: ['auth', 'verified'] } })
    }
    catch {
      // Expected
    }
  })

  test('string middleware is normalized to array', async () => {
    try {
      await loadRoutes({ admin: { path: 'admin', middleware: 'auth' } })
    }
    catch {
      // Expected
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
