import { afterEach, describe, expect, it } from 'bun:test'
import process from 'node:process'

describe('Testing Module', () => {
  describe('setupTestEnvironment()', () => {
    const originalNodeEnv = process.env.NODE_ENV
    const originalAppEnv = process.env.APP_ENV

    afterEach(() => {
      // Restore original env after each test
      if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv
      else delete process.env.NODE_ENV
      if (originalAppEnv !== undefined) process.env.APP_ENV = originalAppEnv
      else delete process.env.APP_ENV
    })

    it('should set NODE_ENV to "test"', async () => {
      const { setupTestEnvironment } = await import('../src/feature')
      process.env.NODE_ENV = 'development'
      setupTestEnvironment()
      expect(process.env.NODE_ENV).toBe('test')
    })

    it('should set APP_ENV to "test"', async () => {
      const { setupTestEnvironment } = await import('../src/feature')
      process.env.APP_ENV = 'production'
      setupTestEnvironment()
      expect(process.env.APP_ENV).toBe('test')
    })

    it('should work when env vars are initially undefined', async () => {
      const { setupTestEnvironment } = await import('../src/feature')
      delete process.env.NODE_ENV
      delete process.env.APP_ENV
      setupTestEnvironment()
      expect(process.env.NODE_ENV).toBe('test')
      expect(process.env.APP_ENV).toBe('test')
    })
  })

  describe('Re-exports from bun:test', () => {
    it('should re-export describe', async () => {
      const testingModule = await import('../src/index')
      expect(testingModule.describe).toBeDefined()
      expect(typeof testingModule.describe).toBe('function')
    })

    it('should re-export it', async () => {
      const testingModule = await import('../src/index')
      expect(testingModule.it).toBeDefined()
      expect(typeof testingModule.it).toBe('function')
    })

    it('should re-export expect', async () => {
      const testingModule = await import('../src/index')
      expect(testingModule.expect).toBeDefined()
      expect(typeof testingModule.expect).toBe('function')
    })

    it('should re-export beforeEach', async () => {
      const testingModule = await import('../src/index')
      expect(testingModule.beforeEach).toBeDefined()
      expect(typeof testingModule.beforeEach).toBe('function')
    })

    it('should re-export afterEach', async () => {
      const testingModule = await import('../src/index')
      expect(testingModule.afterEach).toBeDefined()
      expect(typeof testingModule.afterEach).toBe('function')
    })

    it('should re-export mock', async () => {
      const testingModule = await import('../src/index')
      expect(testingModule.mock).toBeDefined()
    })
  })

  describe('Database test utilities', () => {
    it('should export setupDatabase function', async () => {
      const dbModule = await import('../src/database')
      expect(dbModule.setupDatabase).toBeDefined()
      expect(typeof dbModule.setupDatabase).toBe('function')
    })

    it('should export refreshDatabase function', async () => {
      const dbModule = await import('../src/database')
      expect(dbModule.refreshDatabase).toBeDefined()
      expect(typeof dbModule.refreshDatabase).toBe('function')
    })

    it('should export truncateSqlite function', async () => {
      const dbModule = await import('../src/database')
      expect(dbModule.truncateSqlite).toBeDefined()
      expect(typeof dbModule.truncateSqlite).toBe('function')
    })

    it('should export truncateMysql function', async () => {
      const dbModule = await import('../src/database')
      expect(dbModule.truncateMysql).toBeDefined()
      expect(typeof dbModule.truncateMysql).toBe('function')
    })
  })

  describe('Feature test utilities', () => {
    it('should export setupTestEnvironment from feature module', async () => {
      const featureModule = await import('../src/feature')
      expect(featureModule.setupTestEnvironment).toBeDefined()
      expect(typeof featureModule.setupTestEnvironment).toBe('function')
    })
  })
})
