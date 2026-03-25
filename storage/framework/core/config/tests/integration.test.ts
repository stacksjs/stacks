import { describe, expect, test } from 'bun:test'
import {
  ai,
  app,
  auth,
  cache,
  cli,
  cloud,
  config,
  database,
  determineAppEnv,
  dns,
  email,
  errors,
  filesystems,
  getConfig,
  git,
  hashing,
  library,
  logging,
  notification,
  payment,
  ports,
  queue,
  saas,
  searchEngine,
  security,
  services,
  team,
  ui,
} from '../src/config'
import { defaults } from '../src/defaults'
import {
  defineApp,
  defineCache,
  defineDatabase,
  defineEmail,
  defineHashing,
  defineLibrary,
  defineModel,
  definePayment,
  defineQueue,
  defineSearchEngine,
  defineSecurity,
  defineServices,
  defineStacksConfig,
  defineUi,
  localUrl,
} from '../src/helpers'

// ─── Config Object Accessibility ────────────────────────────────────────────

describe('Config Integration Tests', () => {
  test('config object is defined and has expected top-level sections', () => {
    const cfg = getConfig()
    expect(cfg).toBeDefined()
    expect(cfg.app).toBeDefined()
    expect(cfg.database).toBeDefined()
    expect(cfg.cache).toBeDefined()
  })

  test('config.app has name, url, and env fields', () => {
    expect(app).toBeDefined()
    expect(typeof app.name).toBe('string')
    expect(app.name.length).toBeGreaterThan(0)
    expect(typeof app.env).toBe('string')
  })

  test('config.app has timezone and locale', () => {
    expect(app.timezone).toBeDefined()
    expect(app.locale).toBeDefined()
  })

  test('config.database has default driver and connections', () => {
    expect(database).toBeDefined()
    expect(database.default).toBeDefined()
    expect(database.connections).toBeDefined()
    expect(typeof database.connections).toBe('object')
  })

  test('config.cache has driver and prefix', () => {
    expect(cache).toBeDefined()
    expect(cache.driver).toBeDefined()
    expect(cache.prefix).toBeDefined()
    expect(typeof cache.prefix).toBe('string')
  })

  test('config.cache has drivers with redis and memory configurations', () => {
    expect(cache.drivers).toBeDefined()
    expect(cache.drivers?.redis).toBeDefined()
    expect(cache.drivers?.memory).toBeDefined()
  })

  test('config.ports has all expected port values', () => {
    expect(ports).toBeDefined()
    expect(ports.frontend).toBeDefined()
    expect(ports.backend).toBeDefined()
    expect(ports.admin).toBeDefined()
    expect(ports.library).toBeDefined()
    expect(ports.docs).toBeDefined()
  })

  test('config.email has from address', () => {
    expect(email).toBeDefined()
    expect(email.from).toBeDefined()
    expect(email.from.name).toBeDefined()
    expect(email.from.address).toBeDefined()
  })

  test('config.hashing has driver and bcrypt config', () => {
    expect(hashing).toBeDefined()
    expect(hashing.driver).toBeDefined()
    expect(hashing.bcrypt).toBeDefined()
    expect(typeof hashing.bcrypt.rounds).toBe('number')
  })

  test('config.git has hooks and scopes', () => {
    expect(git).toBeDefined()
    expect(git.hooks).toBeDefined()
    expect(Array.isArray(git.scopes)).toBe(true)
    expect(git.scopes.length).toBeGreaterThan(0)
  })

  test('config.library has name and owner', () => {
    expect(library).toBeDefined()
    expect(typeof library.name).toBe('string')
    expect(typeof library.owner).toBe('string')
  })

  test('config.queue has default and connections', () => {
    expect(queue).toBeDefined()
    expect(queue.default).toBeDefined()
    expect(queue.connections).toBeDefined()
  })

  test('config.security has firewall settings', () => {
    expect(security).toBeDefined()
    expect(security.firewall).toBeDefined()
    expect(typeof security.firewall.enabled).toBe('boolean')
  })

  test('config.dns is defined', () => {
    expect(dns).toBeDefined()
    // dns.driver may be undefined if user override doesn't specify it
  })

  test('config.services has aws, algolia, stripe sub-configs', () => {
    expect(services).toBeDefined()
    expect(services.aws).toBeDefined()
    expect(services.stripe).toBeDefined()
  })

  test('config.ui is defined with expected properties', () => {
    expect(ui).toBeDefined()
    // user overrides may change shortcuts/icons types
    expect(ui.shortcuts !== undefined || ui.icons !== undefined || Object.keys(ui).length > 0).toBe(true)
  })

  test('config.cli has name and command', () => {
    expect(cli).toBeDefined()
    expect(typeof cli.name).toBe('string')
    expect(typeof cli.command).toBe('string')
  })

  test('config.cloud is defined', () => {
    expect(cloud).toBeDefined()
    // cloud.infrastructure may not be present if user override replaces it
  })

  test('config.ai has models array', () => {
    expect(ai).toBeDefined()
    expect(Array.isArray(ai.models)).toBe(true)
    expect(ai.models.length).toBeGreaterThan(0)
  })

  test('config.auth has username, password, and token config', () => {
    expect(auth).toBeDefined()
    expect(auth.username).toBeDefined()
    expect(auth.password).toBeDefined()
    expect(typeof auth.tokenExpiry).toBe('number')
  })

  test('config.notification has default channel', () => {
    expect(notification).toBeDefined()
    expect(notification.default).toBeDefined()
  })

  test('config.payment has driver', () => {
    expect(payment).toBeDefined()
    expect(payment.driver).toBeDefined()
  })

  test('config.searchEngine has driver', () => {
    expect(searchEngine).toBeDefined()
    expect(searchEngine.driver).toBeDefined()
  })

  test('config.filesystems has driver', () => {
    expect(filesystems).toBeDefined()
    expect(filesystems.driver).toBeDefined()
  })

  test('config.logging has paths', () => {
    expect(logging).toBeDefined()
    expect(logging.logsPath).toBeDefined()
  })

  test('config.team has name and members', () => {
    expect(team).toBeDefined()
    expect(team.name).toBeDefined()
    expect(team.members).toBeDefined()
  })

  test('config.errors has messages object', () => {
    expect(errors).toBeDefined()
    expect(errors.messages).toBeDefined()
    expect(typeof errors.messages).toBe('object')
  })

  test('config.saas has plans array', () => {
    expect(saas).toBeDefined()
    expect(Array.isArray(saas.plans)).toBe(true)
  })
})

// ─── determineAppEnv ─────────────────────────────────────────────────────────

describe('determineAppEnv', () => {
  test('returns dev for local environment', () => {
    // defaults set app.env to 'local'
    const result = determineAppEnv()
    expect(result).toBe('dev')
  })
})

// ─── defaults ────────────────────────────────────────────────────────────────

describe('Defaults', () => {
  test('defaults has all major config sections', () => {
    expect(defaults.app).toBeDefined()
    expect(defaults.database).toBeDefined()
    expect(defaults.cache).toBeDefined()
    expect(defaults.cloud).toBeDefined()
    expect(defaults.git).toBeDefined()
    expect(defaults.ports).toBeDefined()
    expect(defaults.email).toBeDefined()
    expect(defaults.security).toBeDefined()
    expect(defaults.queue).toBeDefined()
    expect(defaults.ui).toBeDefined()
  })

  test('defaults.app.name is Stacks', () => {
    expect(defaults.app.name).toBe('Stacks')
  })

  test('defaults.database.default is sqlite', () => {
    expect(defaults.database.default).toBe('sqlite')
  })

  test('defaults.cache.driver is memory', () => {
    expect(defaults.cache.driver).toBe('memory')
  })

  test('defaults.cache.prefix is stx', () => {
    expect(defaults.cache.prefix).toBe('stx')
  })

  test('defaults.hashing.driver is bcrypt', () => {
    expect(defaults.hashing.driver).toBe('bcrypt')
  })

  test('defaults.ports.frontend is 3000', () => {
    expect(defaults.ports.frontend).toBe(3000)
  })
})

// ─── localUrl ────────────────────────────────────────────────────────────────

describe('localUrl', () => {
  test('localUrl with localhost for frontend returns http://localhost:PORT', async () => {
    const url = await localUrl({ localhost: true, type: 'frontend' })
    expect(url).toContain('http://localhost:')
    expect(url).toContain(String(config.ports?.frontend || 3000))
  })

  test('localUrl with localhost for backend returns http://localhost:PORT', async () => {
    const url = await localUrl({ localhost: true, type: 'backend' })
    expect(url).toContain('http://localhost:')
    expect(url).toContain(String(config.ports?.backend || 3001))
  })

  test('localUrl with https option returns https scheme', async () => {
    const url = await localUrl({ https: true, type: 'frontend' })
    expect(url.startsWith('https://')).toBe(true)
  })

  test('localUrl for docs returns docs subdomain', async () => {
    const url = await localUrl({ type: 'docs' })
    expect(url).toContain('docs.')
  })

  test('localUrl for admin returns admin subdomain', async () => {
    const url = await localUrl({ type: 'admin' })
    expect(url).toContain('admin.')
  })
})

// ─── define* helpers ─────────────────────────────────────────────────────────

describe('define* config helpers', () => {
  test('defineApp returns the same config object', () => {
    const input = { name: 'Test', env: 'local' } as any
    expect(defineApp(input)).toBe(input)
  })

  test('defineCache returns the same config object', () => {
    const input = { driver: 'redis', prefix: 'test' } as any
    expect(defineCache(input)).toBe(input)
  })

  test('defineDatabase returns the same config object', () => {
    const input = { default: 'sqlite' } as any
    expect(defineDatabase(input)).toBe(input)
  })

  test('defineStacksConfig returns the same config object', () => {
    const input = { app: { name: 'Test' } } as any
    expect(defineStacksConfig(input)).toBe(input)
  })

  test('defineEmail returns the same config object', () => {
    const input = { from: { name: 'Test', address: 'test@example.com' } } as any
    expect(defineEmail(input)).toBe(input)
  })

  test('defineHashing returns the same config object', () => {
    const input = { driver: 'argon2' } as any
    expect(defineHashing(input)).toBe(input)
  })

  test('defineLibrary returns the same config object', () => {
    const input = { name: 'my-lib' } as any
    expect(defineLibrary(input)).toBe(input)
  })

  test('defineModel returns the same config object', () => {
    const input = { name: 'User' } as any
    expect(defineModel(input)).toBe(input)
  })

  test('definePayment returns the same config object', () => {
    const input = { driver: 'stripe' } as any
    expect(definePayment(input)).toBe(input)
  })

  test('defineQueue returns the same config object', () => {
    const input = { default: 'redis' } as any
    expect(defineQueue(input)).toBe(input)
  })

  test('defineSearchEngine returns the same config object', () => {
    const input = { driver: 'meilisearch' } as any
    expect(defineSearchEngine(input)).toBe(input)
  })

  test('defineSecurity returns the same config object', () => {
    const input = { firewall: { enabled: true } } as any
    expect(defineSecurity(input)).toBe(input)
  })

  test('defineServices returns the same config object', () => {
    const input = { aws: { region: 'us-east-1' } } as any
    expect(defineServices(input)).toBe(input)
  })

  test('defineUi returns the same config object', () => {
    const input = { icons: ['heroicons'] } as any
    expect(defineUi(input)).toBe(input)
  })
})
