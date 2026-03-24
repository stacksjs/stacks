import { describe, expect, mock, test } from 'bun:test'

// Mock dependencies
mock.module('@stacksjs/config', () => ({
  ports: {
    frontend: 3000,
    backend: 3001,
    api: 3002,
    admin: 3003,
    library: 3004,
    desktop: 3005,
    docs: 3006,
    email: 3007,
    inspect: 3008,
    systemTray: 3009,
    database: 3010,
  },
}))

mock.module('@stacksjs/logging', () => ({
  log: { info: () => {}, debug: () => {}, warn: () => {} },
}))

mock.module('@stacksjs/path', () => ({
  path: {
    storagePath: (p: string) => `/storage/${p}`,
    resourcesPath: (p: string) => `/resources/${p}`,
    userModelsPath: () => '/app/Models',
    userJobsPath: () => '/app/Jobs',
    userControllersPath: () => '/app/Controllers',
  },
}))

mock.module('@stacksjs/storage', () => ({
  globSync: () => [],
  mkdirSync: () => {},
  existsSync: () => false,
}))

mock.module('@stacksjs/router', () => ({
  response: {
    json: () => ({}),
    noContent: () => new Response(null, { status: 204 }),
  },
}))

mock.module('@stacksjs/types', () => ({}))

mock.module('bun-plugin-auto-imports', () => ({
  autoImports: () => ({}),
  generateRuntimeIndex: async () => {},
  generateGlobalsScript: async () => {},
}))

describe('server config', () => {
  test('server config function is exported', async () => {
    const mod = await import('../src/index')
    expect(mod.server).toBeDefined()
    expect(typeof mod.server).toBe('function')
  })

  test('server config returns frontend config', async () => {
    const { server } = await import('../src/index')
    const result = server({ type: 'frontend' })
    expect(result.host).toBe('localhost')
    expect(result.port).toBe(3000)
    expect(result.open).toBe(false)
  })

  test('server config returns backend config', async () => {
    const { server } = await import('../src/index')
    const result = server({ type: 'backend' })
    expect(result.host).toBe('localhost')
    expect(result.port).toBe(3001)
  })

  test('server config returns api config', async () => {
    const { server } = await import('../src/index')
    const result = server({ type: 'api' })
    expect(result.port).toBe(3002)
  })

  test('server config returns admin config', async () => {
    const { server } = await import('../src/index')
    const result = server({ type: 'admin' })
    expect(result.port).toBe(3003)
  })

  test('server config returns docs config', async () => {
    const { server } = await import('../src/index')
    const result = server({ type: 'docs' })
    expect(result.port).toBe(3006)
  })

  test('server config uses defaults for unknown type', async () => {
    const { server } = await import('../src/index')
    const result = server({})
    expect(result.host).toBe('stacks.localhost')
    expect(result.port).toBe(3000)
  })

  test('server config respects custom host and port', async () => {
    const { server } = await import('../src/index')
    const result = server({ host: 'custom.local', port: 9999 })
    expect(result.host).toBe('custom.local')
    expect(result.port).toBe(9999)
  })
})

describe('server maintenance', () => {
  test('maintenanceFilePath is exported', async () => {
    const mod = await import('../src/maintenance')
    expect(typeof mod.maintenanceFilePath).toBe('function')
  })

  test('maintenanceFilePath returns a string path', async () => {
    const { maintenanceFilePath } = await import('../src/maintenance')
    const path = maintenanceFilePath()
    expect(typeof path).toBe('string')
    expect(path).toContain('framework/down')
  })

  test('isAllowedIp returns false for empty allowed list', async () => {
    const { isAllowedIp } = await import('../src/maintenance')
    expect(isAllowedIp('192.168.1.1', [])).toBe(false)
  })

  test('isAllowedIp allows localhost IPs', async () => {
    const { isAllowedIp } = await import('../src/maintenance')
    expect(isAllowedIp('127.0.0.1', ['10.0.0.1'])).toBe(true)
    expect(isAllowedIp('::1', ['10.0.0.1'])).toBe(true)
    expect(isAllowedIp('localhost', ['10.0.0.1'])).toBe(true)
  })

  test('isAllowedIp checks against allowed list', async () => {
    const { isAllowedIp } = await import('../src/maintenance')
    expect(isAllowedIp('10.0.0.1', ['10.0.0.1', '10.0.0.2'])).toBe(true)
    expect(isAllowedIp('10.0.0.3', ['10.0.0.1', '10.0.0.2'])).toBe(false)
  })

  test('hasValidBypassCookie checks cookie value', async () => {
    const { hasValidBypassCookie } = await import('../src/maintenance')
    expect(hasValidBypassCookie({ stacks_maintenance_bypass: 'secret123' }, 'secret123')).toBe(true)
    expect(hasValidBypassCookie({ stacks_maintenance_bypass: 'wrong' }, 'secret123')).toBe(false)
    expect(hasValidBypassCookie({}, 'secret123')).toBe(false)
  })

  test('isSecretPath matches secret URL path', async () => {
    const { isSecretPath } = await import('../src/maintenance')
    expect(isSecretPath('/my-secret', 'my-secret')).toBe(true)
    expect(isSecretPath('/my-secret/extra', 'my-secret')).toBe(true)
    expect(isSecretPath('/other', 'my-secret')).toBe(false)
  })

  test('maintenanceHtml returns valid HTML', async () => {
    const { maintenanceHtml } = await import('../src/maintenance')
    const html = maintenanceHtml({ time: Date.now(), message: 'Test maintenance' })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Test maintenance')
    expect(html).toContain('Under Maintenance')
  })

  test('maintenanceHtml includes retry info when provided', async () => {
    const { maintenanceHtml } = await import('../src/maintenance')
    const html = maintenanceHtml({ time: Date.now(), retry: 300 })
    expect(html).toContain('approximately')
  })

  test('maintenanceResponse returns 503 by default', async () => {
    const { maintenanceResponse } = await import('../src/maintenance')
    const resp = maintenanceResponse({ time: Date.now() })
    expect(resp.status).toBe(503)
    expect(resp.headers.get('Content-Type')).toContain('text/html')
  })

  test('maintenanceResponse redirects when redirect is set', async () => {
    const { maintenanceResponse } = await import('../src/maintenance')
    const resp = maintenanceResponse({ time: Date.now(), redirect: '/coming-soon' })
    expect(resp.status).toBe(302)
    expect(resp.headers.get('Location')).toBe('/coming-soon')
  })

  test('maintenanceResponse includes Retry-After header', async () => {
    const { maintenanceResponse } = await import('../src/maintenance')
    const resp = maintenanceResponse({ time: Date.now(), retry: 120 })
    expect(resp.headers.get('Retry-After')).toBe('120')
  })

  test('bypassCookieValue returns valid cookie string', async () => {
    const { bypassCookieValue } = await import('../src/maintenance')
    const cookie = bypassCookieValue('test-secret')
    expect(cookie).toContain('stacks_maintenance_bypass=test-secret')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
  })
})

describe('server controller base', () => {
  test('Controller class is exported', async () => {
    const mod = await import('../src/controllers/base')
    expect(mod.Controller).toBeDefined()
    expect(typeof mod.Controller).toBe('function')
  })

  test('Controller can be instantiated', async () => {
    const { Controller } = await import('../src/controllers/base')
    const ctrl = new Controller()
    expect(ctrl).toBeDefined()
    expect(ctrl).toBeInstanceOf(Controller)
  })
})
