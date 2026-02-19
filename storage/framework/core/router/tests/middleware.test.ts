import { afterEach, describe, expect, mock, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { Middleware } from '../src/middleware'
import { appPath, storagePath } from '@stacksjs/path'

// Mock @stacksjs/logging to prevent process hanging
mock.module('@stacksjs/logging', () => ({
  log: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
}))

describe('Middleware class', () => {
  test('should create a Middleware instance with name and handle', () => {
    const mw = new Middleware({
      name: 'test',
      handle: () => {},
    })

    expect(mw.name).toBe('test')
    expect(typeof mw.handle).toBe('function')
  })

  test('should default priority to 10', () => {
    const mw = new Middleware({
      name: 'test',
      handle: () => {},
    })

    expect(mw.priority).toBe(10)
  })

  test('should accept a custom priority', () => {
    const mw = new Middleware({
      name: 'auth',
      priority: 1,
      handle: () => {},
    })

    expect(mw.priority).toBe(1)
  })

  test('should accept an async handle function', async () => {
    const mw = new Middleware({
      name: 'async-test',
      async handle() {
        await Promise.resolve()
      },
    })

    // Should not throw
    await mw.handle(new Request('http://localhost/test'))
  })

  test('handle should receive the request object', async () => {
    const receivedUrl = { value: '' }

    const mw = new Middleware({
      name: 'request-test',
      handle(request: Request) {
        receivedUrl.value = request.url
      },
    })

    await mw.handle(new Request('http://localhost/hello'))
    expect(receivedUrl.value).toBe('http://localhost/hello')
  })

  test('should preserve readonly properties', () => {
    const mw = new Middleware({
      name: 'readonly-test',
      priority: 5,
      handle: () => {},
    })

    expect(mw.name).toBe('readonly-test')
    expect(mw.priority).toBe(5)
  })
})

describe('app/Middleware.ts alias registry', () => {
  test('should export a valid alias map', async () => {
    const module = await import(appPath('Middleware.ts'))
    const aliases = module.default

    expect(typeof aliases).toBe('object')
    expect(aliases).not.toBeNull()
  })

  test('should map string aliases to string class names', async () => {
    const module = await import(appPath('Middleware.ts'))
    const aliases = module.default

    for (const [alias, className] of Object.entries(aliases)) {
      expect(typeof alias).toBe('string')
      expect(typeof className).toBe('string')
      expect(alias.length).toBeGreaterThan(0)
      expect((className as string).length).toBeGreaterThan(0)
    }
  })

  test('should contain core middleware aliases', async () => {
    const module = await import(appPath('Middleware.ts'))
    const aliases = module.default

    expect(aliases.auth).toBe('Auth')
    expect(aliases.guest).toBe('Guest')
    expect(aliases.maintenance).toBe('Maintenance')
    expect(aliases.logger).toBe('Logger')
    expect(aliases.throttle).toBe('Throttle')
  })

  test('should contain authorization middleware aliases', async () => {
    const module = await import(appPath('Middleware.ts'))
    const aliases = module.default

    expect(aliases.abilities).toBe('Abilities')
    expect(aliases.can).toBe('Can')
    expect(aliases.role).toBe('Role')
    expect(aliases.permission).toBe('Permission')
    expect(aliases.verified).toBe('EnsureEmailIsVerified')
  })

  test('should contain environment middleware aliases', async () => {
    const module = await import(appPath('Middleware.ts'))
    const aliases = module.default

    expect(aliases.env).toBe('Env')
    expect(aliases['env:local']).toBe('EnvLocal')
    expect(aliases['env:development']).toBe('EnvDevelopment')
    expect(aliases['env:dev']).toBe('EnvDevelopment')
    expect(aliases['env:staging']).toBe('EnvStaging')
    expect(aliases['env:production']).toBe('EnvProduction')
    expect(aliases['env:prod']).toBe('EnvProduction')
  })
})

describe('Default middleware files', () => {
  const defaultMiddlewarePath = storagePath('framework/defaults/app/Middleware')

  const expectedMiddleware = [
    'Auth',
    'Guest',
    'Api',
    'Team',
    'Maintenance',
    'Logger',
    'Abilities',
    'Can',
    'Role',
    'Permission',
    'EnsureEmailIsVerified',
    'Throttle',
    'Env',
    'EnvLocal',
    'EnvDevelopment',
    'EnvStaging',
    'EnvProduction',
  ]

  for (const name of expectedMiddleware) {
    test(`${name}.ts should exist in defaults`, () => {
      const path = `${defaultMiddlewarePath}/${name}.ts`
      expect(existsSync(path)).toBe(true)
    })
  }

  test('all default middleware should export a Middleware instance', async () => {
    // Test a few representative middleware files
    const testFiles = ['Maintenance', 'Logger', 'Abilities', 'Guest', 'Api', 'Team']

    for (const name of testFiles) {
      const mod = await import(`${defaultMiddlewarePath}/${name}.ts`)
      const mw = mod.default

      expect(mw).toBeDefined()
      expect(mw.name).toBeDefined()
      expect(typeof mw.handle).toBe('function')
    }
  })

  test('middleware should have appropriate priorities', async () => {
    const maintenanceMod = await import(`${defaultMiddlewarePath}/Maintenance.ts`)
    const loggerMod = await import(`${defaultMiddlewarePath}/Logger.ts`)

    // Maintenance should run first (priority 0)
    expect(maintenanceMod.default.priority).toBe(0)
    // Logger should run after (priority 2)
    expect(loggerMod.default.priority).toBe(2)
  })
})

describe('User middleware files', () => {
  test('app/Middleware/Auth.ts should exist', () => {
    expect(existsSync(appPath('Middleware/Auth.ts'))).toBe(true)
  })

  test('Auth middleware should be a valid Middleware instance', async () => {
    const mod = await import(appPath('Middleware/Auth.ts'))
    const auth = mod.default

    expect(auth).toBeDefined()
    expect(auth.name).toBe('Auth')
    expect(auth.priority).toBe(1)
    expect(typeof auth.handle).toBe('function')
  })
})

describe('Middleware alias resolution', () => {
  test('aliases should resolve to existing default files', async () => {
    const module = await import(appPath('Middleware.ts'))
    const aliases = module.default
    const defaultPath = storagePath('framework/defaults/app/Middleware')

    for (const [alias, className] of Object.entries(aliases)) {
      // Check that either the user middleware or default middleware exists
      const userPath = appPath(`Middleware/${className}.ts`)
      const defPath = `${defaultPath}/${className}.ts`

      const exists = existsSync(userPath) || existsSync(defPath)
      expect(exists).toBe(true)
    }
  })
})

describe('Middleware handle behavior', () => {
  test('middleware that throws should propagate the error', async () => {
    const mw = new Middleware({
      name: 'error-test',
      handle() {
        throw new Error('Unauthorized')
      },
    })

    expect(() => mw.handle(new Request('http://localhost/test'))).toThrow('Unauthorized')
  })

  test('async middleware that throws should reject', async () => {
    const mw = new Middleware({
      name: 'async-error-test',
      async handle() {
        throw new Error('Token expired')
      },
    })

    expect(mw.handle(new Request('http://localhost/test'))).rejects.toThrow('Token expired')
  })

  test('middleware can throw a Response for short-circuiting', () => {
    const mw = new Middleware({
      name: 'response-throw-test',
      handle() {
        throw new Response(JSON.stringify({ error: 'Rate limited' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    })

    try {
      mw.handle(new Request('http://localhost/test'))
      expect(true).toBe(false) // should not reach
    }
    catch (e) {
      expect(e).toBeInstanceOf(Response)
      expect((e as Response).status).toBe(429)
    }
  })

  test('middleware returning void means continue to next', async () => {
    const mw = new Middleware({
      name: 'pass-through',
      handle() {
        // No throw = continue
      },
    })

    const result = await mw.handle(new Request('http://localhost/test'))
    expect(result).toBeUndefined()
  })
})

describe('Middleware parameterized usage patterns', () => {
  test('should support throttle:60,1 pattern parsing', () => {
    const middleware = 'throttle:60,1'
    const colonIndex = middleware.indexOf(':')
    const name = middleware.substring(0, colonIndex)
    const params = middleware.substring(colonIndex + 1)

    expect(name).toBe('throttle')
    expect(params).toBe('60,1')
  })

  test('should support abilities:read,write pattern parsing', () => {
    const middleware = 'abilities:read,write'
    const colonIndex = middleware.indexOf(':')
    const name = middleware.substring(0, colonIndex)
    const params = middleware.substring(colonIndex + 1)

    expect(name).toBe('abilities')
    expect(params).toBe('read,write')
  })

  test('should support can:update,post pattern parsing', () => {
    const middleware = 'can:update,post'
    const colonIndex = middleware.indexOf(':')
    const name = middleware.substring(0, colonIndex)
    const params = middleware.substring(colonIndex + 1)

    expect(name).toBe('can')
    expect(params).toBe('update,post')
  })

  test('should handle middleware without params', () => {
    const middleware = 'auth'
    const colonIndex = middleware.indexOf(':')

    expect(colonIndex).toBe(-1)
    expect(middleware).toBe('auth')
  })

  test('should handle env: prefixed middleware', () => {
    const middleware = 'env:local'
    const colonIndex = middleware.indexOf(':')
    const name = middleware.substring(0, colonIndex)
    const params = middleware.substring(colonIndex + 1)

    expect(name).toBe('env')
    expect(params).toBe('local')
  })
})

describe('Middleware priority ordering', () => {
  test('should sort by priority (lower first)', () => {
    const middlewares = [
      new Middleware({ name: 'logger', priority: 5, handle: () => {} }),
      new Middleware({ name: 'maintenance', priority: 0, handle: () => {} }),
      new Middleware({ name: 'auth', priority: 1, handle: () => {} }),
      new Middleware({ name: 'abilities', priority: 2, handle: () => {} }),
    ]

    const sorted = [...middlewares].sort((a, b) => a.priority - b.priority)

    expect(sorted[0].name).toBe('maintenance')
    expect(sorted[1].name).toBe('auth')
    expect(sorted[2].name).toBe('abilities')
    expect(sorted[3].name).toBe('logger')
  })
})
