import { describe, expect, test } from 'bun:test'
import {
  ai,
  analytics,
  app,
  auth,
  cache,
  cli,
  cloud,
  config,
  database,
  defaults,
  determineAppEnv,
  dns,
  docs,
  email,
  errors,
  filesystems,
  getConfig,
  git,
  hashing,
  library,
  localUrl,
  logging,
  notification,
  overrides,
  payment,
  ports,
  queue,
  realtime,
  saas,
  searchEngine,
  security,
  services,
  team,
  ui,
} from '../src/config'

describe('config', () => {
  describe('config object', () => {
    test('config is defined and is an object', () => {
      expect(config).toBeDefined()
      expect(typeof config).toBe('object')
    })

    test('getConfig returns the same config object', () => {
      const retrieved = getConfig()
      expect(retrieved).toBe(config)
    })
  })

  describe('config section exports', () => {
    test('app config is accessible', () => {
      expect(app).toBeDefined()
      expect(typeof app).toBe('object')
    })

    test('auth config is accessible', () => {
      expect(auth).toBeDefined()
      expect(typeof auth).toBe('object')
    })

    test('database config is accessible', () => {
      expect(database).toBeDefined()
      expect(typeof database).toBe('object')
    })

    test('cache config is accessible', () => {
      expect(cache).toBeDefined()
      expect(typeof cache).toBe('object')
    })

    test('cloud config is accessible', () => {
      expect(cloud).toBeDefined()
      expect(typeof cloud).toBe('object')
    })

    test('email config is accessible', () => {
      expect(email).toBeDefined()
      expect(typeof email).toBe('object')
    })

    test('security config is accessible', () => {
      expect(security).toBeDefined()
      expect(typeof security).toBe('object')
    })

    test('all major config sections exist', () => {
      expect(ai).toBeDefined()
      expect(analytics).toBeDefined()
      expect(realtime).toBeDefined()
      expect(cli).toBeDefined()
      expect(dns).toBeDefined()
      expect(docs).toBeDefined()
      expect(errors).toBeDefined()
      expect(git).toBeDefined()
      expect(hashing).toBeDefined()
      expect(library).toBeDefined()
      expect(logging).toBeDefined()
      expect(notification).toBeDefined()
      expect(payment).toBeDefined()
      expect(ports).toBeDefined()
      expect(queue).toBeDefined()
      expect(saas).toBeDefined()
      expect(searchEngine).toBeDefined()
      expect(services).toBeDefined()
      expect(filesystems).toBeDefined()
      expect(team).toBeDefined()
      expect(ui).toBeDefined()
    })
  })

  describe('defaults and overrides exports', () => {
    test('defaults object is exported', () => {
      expect(defaults).toBeDefined()
      expect(typeof defaults).toBe('object')
    })

    test('overrides object is exported', () => {
      expect(overrides).toBeDefined()
      expect(typeof overrides).toBe('object')
    })
  })

  describe('localUrl helper', () => {
    test('returns frontend URL by default', async () => {
      const url = await localUrl({ localhost: true })
      expect(url).toContain('localhost')
      expect(url).toContain(String(config.ports?.frontend || 3000))
    })

    test('returns backend URL with type backend', async () => {
      const url = await localUrl({ type: 'backend', localhost: true })
      expect(url).toBe(`http://localhost:${config.ports?.backend}`)
    })

    test('returns admin URL with type admin', async () => {
      const url = await localUrl({ type: 'admin', localhost: true })
      expect(url).toBe(`http://localhost:${config.ports?.admin}`)
    })

    test('returns docs URL with type docs', async () => {
      const url = await localUrl({ type: 'docs', localhost: true })
      expect(url).toBe(`http://localhost:${config.ports?.docs}`)
    })

    test('returns email URL with type email', async () => {
      const url = await localUrl({ type: 'email', localhost: true })
      expect(url).toBe(`http://localhost:${config.ports?.email}`)
    })

    test('returns library URL with type library', async () => {
      const url = await localUrl({ type: 'library', localhost: true })
      expect(url).toBe(`http://localhost:${config.ports?.library}`)
    })

    test('returns desktop URL with type desktop', async () => {
      const url = await localUrl({ type: 'desktop', localhost: true })
      expect(url).toBe(`http://localhost:${config.ports?.desktop}`)
    })

    test('returns inspect URL with type inspect', async () => {
      const url = await localUrl({ type: 'inspect', localhost: true })
      expect(url).toBe(`http://localhost:${config.ports?.inspect}`)
    })

    test('returns https URL when https option is true', async () => {
      const url = await localUrl({ https: true })
      expect(url).toMatch(/^https:\/\//)
    })

    test('returns http URL by default', async () => {
      const url = await localUrl()
      expect(url).toMatch(/^http:\/\//)
    })
  })

  describe('determineAppEnv', () => {
    test('returns dev for local environment', () => {
      // app.env defaults to "local"
      expect(determineAppEnv()).toBe('dev')
    })
  })

  describe('config values have expected types', () => {
    test('app has name and url', () => {
      expect(typeof app.name).toBe('string')
      expect(typeof app.url).toBe('string')
    })

    test('ports are defined', () => {
      expect(ports?.frontend).toBeDefined()
      expect(ports?.backend).toBeDefined()
      expect(ports?.admin).toBeDefined()
    })

    test('database has default driver', () => {
      expect(database?.default).toBeDefined()
      expect(typeof database?.default).toBe('string')
    })
  })
})
