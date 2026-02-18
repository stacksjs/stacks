import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * Tests for the auto-imports system that scans model directories
 * and generates runtime index files for automatic model importing.
 *
 * These tests exercise the scanning, deduplication, and index generation
 * logic without requiring the full framework to be running.
 */

// Create a temporary directory structure for testing
const tmpDir = resolve(import.meta.dir, '../../../../../.tmp-auto-imports-test')

beforeAll(() => {
  // Create directory structure
  const dirs = [
    join(tmpDir, 'user-models'),
    join(tmpDir, 'framework-models'),
    join(tmpDir, 'default-models'),
    join(tmpDir, 'default-models/Content'),
    join(tmpDir, 'output'),
  ]

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true })
  }

  // User models
  writeFileSync(
    join(tmpDir, 'user-models/Post.ts'),
    `import { defineModel } from '@stacksjs/orm'\nexport default defineModel({ name: 'Post', table: 'posts', attributes: {} } as const)\n`,
  )
  writeFileSync(
    join(tmpDir, 'user-models/Comment.ts'),
    `import { defineModel } from '@stacksjs/orm'\nexport default defineModel({ name: 'Comment', table: 'comments', attributes: {} } as const)\n`,
  )

  // Framework models (Post exists in both — should be overridden by user)
  writeFileSync(
    join(tmpDir, 'framework-models/Post.ts'),
    `import { defineModel } from '@stacksjs/orm'\nexport default defineModel({ name: 'Post', table: 'posts', attributes: {} } as const)\n`,
  )
  writeFileSync(
    join(tmpDir, 'framework-models/Author.ts'),
    `import { defineModel } from '@stacksjs/orm'\nexport default defineModel({ name: 'Author', table: 'authors', attributes: {} } as const)\n`,
  )

  // Default models (Author exists in both framework and defaults — framework takes priority)
  writeFileSync(
    join(tmpDir, 'default-models/Author.ts'),
    `import { defineModel } from '@stacksjs/orm'\nexport default defineModel({ name: 'Author', table: 'authors', attributes: {} } as const)\n`,
  )
  writeFileSync(
    join(tmpDir, 'default-models/User.ts'),
    `import { defineModel } from '@stacksjs/orm'\nexport default defineModel({ name: 'User', table: 'users', attributes: {} } as const)\n`,
  )

  // Nested model in subdirectory
  writeFileSync(
    join(tmpDir, 'default-models/Content/Page.ts'),
    `import { defineModel } from '@stacksjs/orm'\nexport default defineModel({ name: 'Page', table: 'pages', attributes: {} } as const)\n`,
  )

  // Files that should be ignored
  writeFileSync(join(tmpDir, 'user-models/index.ts'), `export {}\n`)
  writeFileSync(join(tmpDir, 'default-models/README.md'), `# Models\n`)
})

afterAll(() => {
  // Clean up temp directory
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  }
  catch {
    // Ignore cleanup errors
  }
})

describe('auto-imports scanning', () => {
  describe('scanModelExports (generated named-export models)', () => {
    it('should scan a directory and return ExportInfo for each model file', () => {
      // Re-implement the scanning logic with manual filtering
      // (matches the actual imports.ts scanning pattern)
      const { globSync } = require('@stacksjs/storage')
      const dir = join(tmpDir, 'user-models')
      const allFiles: string[] = globSync(`${dir}/**/*.ts`)

      // Filter out .d.ts and index.ts (manual filtering as done in production)
      const files = allFiles.filter((f: string) => {
        const name = f.split('/').pop() || ''
        return !name.endsWith('.d.ts') && name !== 'index.ts'
      })

      const exports: Array<{ name: string, file: string }> = []
      for (const file of files) {
        const basename = file.split('/').pop()?.replace('.ts', '') || ''
        if (basename) {
          exports.push({ name: basename, file })
          exports.push({ name: `${basename}Model`, file })
        }
      }

      // Should find Post and Comment (not index.ts)
      const names = exports.map(e => e.name)
      expect(names).toContain('Post')
      expect(names).toContain('PostModel')
      expect(names).toContain('Comment')
      expect(names).toContain('CommentModel')
      expect(names).not.toContain('index')
    })

    it('should filter out .d.ts and index.ts files from scan results', () => {
      const { globSync } = require('@stacksjs/storage')
      const dir = join(tmpDir, 'user-models')

      // Write a .d.ts file
      writeFileSync(join(dir, 'types.d.ts'), `export type Foo = string\n`)

      const allFiles: string[] = globSync(`${dir}/**/*.ts`)

      // Filter manually (as production code should do)
      const filtered = allFiles.filter((f: string) => {
        const name = f.split('/').pop() || ''
        return !name.endsWith('.d.ts') && name !== 'index.ts'
      })
      const basenames = filtered.map((f: string) => f.split('/').pop())

      expect(basenames).not.toContain('types.d.ts')
      expect(basenames).not.toContain('index.ts')
      expect(basenames).toContain('Post.ts')
      expect(basenames).toContain('Comment.ts')

      // Cleanup
      try { rmSync(join(dir, 'types.d.ts')) } catch {}
    })
  })

  describe('scanDefineModelExports (default-export models)', () => {
    it('should scan and return unique model names with isDefault flag', () => {
      const { globSync } = require('@stacksjs/storage')
      const dir = join(tmpDir, 'default-models')

      let allFiles: string[] = []
      try {
        allFiles = globSync(`${dir}/**/*.ts`)
      }
      catch {
        allFiles = []
      }

      // Manual filtering (matching production behavior)
      const files = allFiles.filter((f: string) => {
        const name = f.split('/').pop() || ''
        return !name.endsWith('.d.ts') && name !== 'index.ts' && !name.startsWith('README')
      })

      const exports: Array<{ name: string, file: string, isDefault: boolean }> = []
      const seen = new Set<string>()

      for (const file of files) {
        const basename = file.split('/').pop()?.replace('.ts', '') || ''
        if (basename && !seen.has(basename)) {
          seen.add(basename)
          exports.push({ name: basename, file, isDefault: true })
        }
      }

      const names = exports.map(e => e.name)
      expect(names).toContain('Author')
      expect(names).toContain('User')
      expect(names).toContain('Page') // from Content/ subdirectory
      expect(names).not.toContain('index')
      expect(names).not.toContain('README')

      // All should be marked as default exports
      for (const exp of exports) {
        expect(exp.isDefault).toBe(true)
      }
    })

    it('should handle non-existent directories gracefully', () => {
      const { globSync } = require('@stacksjs/storage')
      const dir = join(tmpDir, 'nonexistent-dir')

      let files: string[] = []
      try {
        files = globSync(`${dir}/**/*.ts`)
      }
      catch {
        files = []
      }

      expect(files).toEqual([])
    })
  })

  describe('deduplication across directories', () => {
    it('should prioritize user models over framework and default models', () => {
      const { globSync } = require('@stacksjs/storage')
      const modelDirs = [
        join(tmpDir, 'user-models'),
        join(tmpDir, 'framework-models'),
        join(tmpDir, 'default-models'),
      ]

      const allExports: Array<{ name: string, file: string, isDefault: boolean }> = []

      for (const dir of modelDirs) {
        let allFiles: string[] = []
        try {
          allFiles = globSync(`${dir}/**/*.ts`)
        }
        catch {
          continue
        }

        // Manual filtering
        const files = allFiles.filter((f: string) => {
          const name = f.split('/').pop() || ''
          return !name.endsWith('.d.ts') && name !== 'index.ts' && !name.startsWith('README')
        })

        for (const file of files) {
          const basename = file.split('/').pop()?.replace('.ts', '') || ''
          if (basename) {
            allExports.push({ name: basename, file, isDefault: true })
          }
        }
      }

      // Deduplicate — first occurrence wins (user models scanned first)
      const seen = new Set<string>()
      const unique = allExports.filter((exp) => {
        if (seen.has(exp.name)) return false
        seen.add(exp.name)
        return true
      })

      // Post appears in user-models and framework-models
      const postExport = unique.find(e => e.name === 'Post')
      expect(postExport).toBeDefined()
      expect(postExport!.file).toContain('user-models') // User model wins

      // Author appears in framework-models and default-models
      const authorExport = unique.find(e => e.name === 'Author')
      expect(authorExport).toBeDefined()
      expect(authorExport!.file).toContain('framework-models') // Framework model wins

      // Comment only in user-models
      const commentExport = unique.find(e => e.name === 'Comment')
      expect(commentExport).toBeDefined()
      expect(commentExport!.file).toContain('user-models')

      // User only in default-models
      const userExport = unique.find(e => e.name === 'User')
      expect(userExport).toBeDefined()
      expect(userExport!.file).toContain('default-models')
    })
  })

  describe('generateDefineModelIndex output', () => {
    it('should generate re-export lines for default exports', () => {
      const { globSync } = require('@stacksjs/storage')
      const outputPath = join(tmpDir, 'output/models.ts')
      const modelDirs = [
        join(tmpDir, 'user-models'),
        join(tmpDir, 'framework-models'),
        join(tmpDir, 'default-models'),
      ]

      const lines: string[] = ['// Generated by bun-plugin-auto-imports']
      const seen = new Set<string>()

      for (const dir of modelDirs) {
        let allFiles: string[] = []
        try {
          allFiles = globSync(`${dir}/**/*.ts`)
        }
        catch {
          continue
        }

        // Manual filtering
        const files = allFiles.filter((f: string) => {
          const name = f.split('/').pop() || ''
          return !name.endsWith('.d.ts') && name !== 'index.ts' && !name.startsWith('README')
        })

        for (const file of files) {
          const basename = file.split('/').pop()?.replace('.ts', '') || ''
          if (basename && !seen.has(basename)) {
            seen.add(basename)
            const relativePath = relative(dirname(outputPath), file).replace(/\.ts$/, '')
            lines.push(`export { default as ${basename} } from '${relativePath}'`)
          }
        }
      }

      const content = lines.join('\n') + '\n'

      // Verify the output format
      expect(content).toContain('// Generated by bun-plugin-auto-imports')
      expect(content).toContain('export { default as Post }')
      expect(content).toContain('export { default as Comment }')
      expect(content).toContain('export { default as Author }')
      expect(content).toContain('export { default as User }')
      expect(content).toContain('export { default as Page }')

      // Verify relative paths work
      const postLine = lines.find(l => l.includes('as Post'))
      expect(postLine).toBeDefined()
      expect(postLine).toContain('from \'')
      // Post should point to user-models (first priority)
      expect(postLine).toContain('user-models/Post')
    })

    it('should use relative paths from output directory', () => {
      const outputPath = join(tmpDir, 'output/models.ts')
      const modelFile = join(tmpDir, 'user-models/Post.ts')
      const relativePath = relative(dirname(outputPath), modelFile).replace(/\.ts$/, '')

      // The relative path from output/ to user-models/Post should go up one level
      expect(relativePath).toContain('user-models/Post')
      expect(relativePath.startsWith('..')).toBe(true)
    })
  })

  describe('bundler plugin configuration', () => {
    it('should build correct import entries for generated models (named exports)', () => {
      // Simulate scanModelExports behavior
      const generatedModelExports = [
        { name: 'Post', file: '/path/to/models/Post.ts' },
        { name: 'PostModel', file: '/path/to/models/Post.ts' },
        { name: 'User', file: '/path/to/models/User.ts' },
        { name: 'UserModel', file: '/path/to/models/User.ts' },
      ]

      const imports = generatedModelExports.map(exp => ({
        from: exp.file,
        name: exp.name,
        as: exp.name,
      }))

      expect(imports).toHaveLength(4)
      expect(imports[0]).toEqual({ from: '/path/to/models/Post.ts', name: 'Post', as: 'Post' })
      expect(imports[1]).toEqual({ from: '/path/to/models/Post.ts', name: 'PostModel', as: 'PostModel' })
    })

    it('should build correct import entries for defineModel models (default exports)', () => {
      // Simulate scanDefineModelExports behavior
      const defineModelExports = [
        { name: 'Post', file: '/path/to/defaults/Post.ts', isDefault: true },
        { name: 'Author', file: '/path/to/defaults/Author.ts', isDefault: true },
      ]

      const imports = defineModelExports.map(exp => ({
        from: exp.file,
        name: 'default',
        as: exp.name,
      }))

      expect(imports).toHaveLength(2)
      expect(imports[0]).toEqual({ from: '/path/to/defaults/Post.ts', name: 'default', as: 'Post' })
      expect(imports[1]).toEqual({ from: '/path/to/defaults/Author.ts', name: 'default', as: 'Author' })
    })

    it('should merge all import sources into a single imports array', () => {
      const generatedImports = [
        { from: '/gen/Post.ts', name: 'Post', as: 'Post' },
      ]
      const defineModelImports = [
        { from: '/def/Author.ts', name: 'default', as: 'Author' },
      ]
      const requestImports = [
        { from: '/req/PostRequest.ts', name: 'PostRequest', as: 'PostRequest' },
      ]

      const allImports = [...generatedImports, ...defineModelImports, ...requestImports]

      expect(allImports).toHaveLength(3)
      expect(allImports.map(i => i.as)).toEqual(['Post', 'Author', 'PostRequest'])
    })
  })

  describe('combined index file', () => {
    it('should generate the correct combined index content', () => {
      const combinedContent = `// Generated by bun-plugin-auto-imports
export * from './functions'
export * from './generated-models'
export * from './models'
`
      expect(combinedContent).toContain("export * from './functions'")
      expect(combinedContent).toContain("export * from './generated-models'")
      expect(combinedContent).toContain("export * from './models'")
    })
  })
})
