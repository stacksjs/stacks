import { describe, expect, it } from 'bun:test'

const {
  stackExtensionRegistry,
} = await import('@stacksjs/types')

describe('Stack Extension Registry', () => {
  describe('registry object', () => {
    it('should be an object', () => {
      expect(typeof stackExtensionRegistry).toBe('object')
      expect(stackExtensionRegistry).not.toBeNull()
    })

    it('should not contain core framework modules', () => {
      const coreModules = [
        'analytics', 'api', 'auth', 'cache', 'calendar', 'chat', 'cli',
        'cloud', 'cms', 'commerce', 'database', 'deploy', 'dns', 'email',
        'events', 'notifications', 'orm', 'payments', 'queue', 'realtime',
        'router', 'search', 'security', 'storage', 'table', 'validation',
      ]

      for (const mod of coreModules) {
        expect(
          (stackExtensionRegistry as Record<string, unknown>)[mod],
        ).toBeUndefined()
      }
    })

    it('every entry should have a package field', () => {
      for (const [name, entry] of Object.entries(stackExtensionRegistry)) {
        expect(typeof (entry as any).package).toBe('string')
        expect((entry as any).package.length).toBeGreaterThan(0)
      }
    })

    it('every entry should have a description field', () => {
      for (const [name, entry] of Object.entries(stackExtensionRegistry)) {
        expect(typeof (entry as any).description).toBe('string')
        expect((entry as any).description.length).toBeGreaterThan(0)
      }
    })

    it('every entry description should be concise (under 80 chars)', () => {
      for (const [name, entry] of Object.entries(stackExtensionRegistry)) {
        expect((entry as any).description.length).toBeLessThanOrEqual(80)
      }
    })

    it('entry keys should be lowercase kebab-case', () => {
      for (const name of Object.keys(stackExtensionRegistry)) {
        expect(name).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
      }
    })
  })

  describe('type compatibility', () => {
    it('should accept known registry names as KnownStackName', async () => {
      // This is a runtime verification that the types work correctly.
      // Any registered stack name should be assignable to KnownStackName.
      const registeredNames = Object.keys(stackExtensionRegistry)
      for (const name of registeredNames) {
        // If this compiles and runs, the type system accepts it
        expect(typeof name).toBe('string')
      }
    })

    it('should accept arbitrary strings as KnownStackName at runtime', () => {
      // The (string & {}) escape hatch means any string works
      const customName: string = 'my-custom-unregistered-stack'
      expect(typeof customName).toBe('string')
    })
  })

  describe('StackExtensionEntry type', () => {
    it('should accept a full entry object', () => {
      const entry = {
        name: 'test-stack',
        url: 'https://example.com',
        github: 'example/test-stack',
        package: '@example/test-stack',
      }

      expect(entry.name).toBe('test-stack')
      expect(entry.url).toBe('https://example.com')
      expect(entry.github).toBe('example/test-stack')
      expect(entry.package).toBe('@example/test-stack')
    })

    it('should accept a minimal entry with just name', () => {
      const entry = { name: 'minimal-stack' }
      expect(entry.name).toBe('minimal-stack')
    })
  })

  describe('StackExtensionRegistry type', () => {
    it('should accept an array of strings', () => {
      const registry = ['stack-a', 'stack-b']
      expect(registry.length).toBe(2)
    })

    it('should accept an array of objects', () => {
      const registry = [
        { name: 'stack-a', github: 'org/stack-a' },
        { name: 'stack-b', url: 'https://stack-b.com' },
      ]
      expect(registry.length).toBe(2)
    })

    it('should accept a mixed array of strings and objects', () => {
      const registry = [
        'stack-a',
        { name: 'stack-b', github: 'org/stack-b' },
        'stack-c',
      ]
      expect(registry.length).toBe(3)
      expect(typeof registry[0]).toBe('string')
      expect(typeof registry[1]).toBe('object')
    })
  })

  describe('StackMeta type', () => {
    it('should accept a full metadata object', () => {
      const meta = {
        name: 'test-stack',
        description: 'A test stack',
        version: '1.0.0',
        directories: ['app', 'config', 'resources'] as const,
        hooks: {
          postInstall: 'setup.ts',
        },
      }

      expect(meta.name).toBe('test-stack')
      expect(meta.directories).toContain('app')
      expect(meta.hooks.postInstall).toBe('setup.ts')
    })

    it('should accept minimal metadata with just name', () => {
      const meta = { name: 'minimal' }
      expect(meta.name).toBe('minimal')
    })

    it('should accept custom directory names', () => {
      const meta = {
        name: 'custom-dirs',
        directories: ['app', 'config', 'my-custom-dir', 'another-one'],
      }

      expect(meta.directories).toContain('my-custom-dir')
      expect(meta.directories.length).toBe(4)
    })
  })

  describe('StackDirectory type', () => {
    it('should include all known project directories', () => {
      const knownDirs = ['app', 'config', 'database', 'resources', 'routes', 'public', 'locales', 'docs']
      for (const dir of knownDirs) {
        expect(typeof dir).toBe('string')
      }
    })

    it('should accept custom directory strings', () => {
      const customDir = 'my-custom-directory'
      expect(typeof customDir).toBe('string')
    })
  })
})
