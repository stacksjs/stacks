import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const { makeStack } = await import('../src/make')

// Track created directories for cleanup
const createdDirs: string[] = []

function cleanup() {
  for (const dir of createdDirs) {
    try {
      if (existsSync(dir))
        rmSync(dir, { recursive: true, force: true })
    }
    catch {}
  }
  createdDirs.length = 0
}

afterEach(cleanup)

describe('makeStack', () => {
  describe('scaffolding', () => {
    it('should create a stack directory with package.json', async () => {
      const name = 'test-make-stack-basic'
      const stackDir = resolve(process.cwd(), name)
      createdDirs.push(stackDir)

      await makeStack({ name } as any)

      expect(existsSync(stackDir)).toBe(true)
      expect(existsSync(join(stackDir, 'package.json'))).toBe(true)
    })

    it('should create package.json with stacks field', async () => {
      const name = 'test-make-stack-pkg'
      const stackDir = resolve(process.cwd(), name)
      createdDirs.push(stackDir)

      await makeStack({ name } as any)

      const pkg = JSON.parse(readFileSync(join(stackDir, 'package.json'), 'utf-8'))

      expect(pkg.name).toBe(name)
      expect(pkg.version).toBe('0.0.1')
      expect(pkg.type).toBe('module')
      expect(pkg.stacks).toBeDefined()
      expect(pkg.stacks.name).toBe(name)
      expect(pkg.stacks.description).toBe('A Stacks extension')
    })

    it('should create standard directory structure', async () => {
      const name = 'test-make-stack-dirs'
      const stackDir = resolve(process.cwd(), name)
      createdDirs.push(stackDir)

      await makeStack({ name } as any)

      const expectedDirs = [
        'app/Actions',
        'app/Models',
        'config',
        'database/migrations',
        'resources/views',
        'resources/components',
        'resources/functions',
        'routes',
        'public',
      ]

      for (const dir of expectedDirs) {
        expect(existsSync(join(stackDir, dir))).toBe(true)
      }
    })

    it('should derive short name for scoped packages', async () => {
      const name = '@stacksjs/blog-stack'
      // For scoped names, the directory name uses the full name which may
      // not be valid as a path with @, so test the short name derivation
      // by checking what's in the package.json stacks.name field
      const stackDir = resolve(process.cwd(), name)
      createdDirs.push(stackDir)

      await makeStack({ name } as any)

      const pkg = JSON.parse(readFileSync(join(stackDir, 'package.json'), 'utf-8'))
      // @stacksjs/blog-stack -> strip scope -> blog-stack -> strip -stack suffix -> blog
      expect(pkg.stacks.name).toBe('blog')
    })

    it('should strip -stack suffix from short name', async () => {
      const name = 'my-blog-stack'
      const stackDir = resolve(process.cwd(), name)
      createdDirs.push(stackDir)

      await makeStack({ name } as any)

      const pkg = JSON.parse(readFileSync(join(stackDir, 'package.json'), 'utf-8'))
      expect(pkg.stacks.name).toBe('my-blog')
    })
  })
})
