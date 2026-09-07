import type { StacksSourceModules } from './provenance'
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO_ROOT } from './runtime'
import { resolveStacksSourceModules, STACKS_BENCHMARK_MODULES, STACKS_FIXTURE_MODULES, stacksSourceIssues } from './provenance'

describe('Stacks benchmark source provenance', () => {
  it('resolves every framework dependency through the server config to source', () => {
    const modules = resolveStacksSourceModules(REPO_ROOT)
    expect(Object.keys(modules).sort()).toEqual([...STACKS_BENCHMARK_MODULES].sort())
    for (const [specifier, path] of Object.entries(modules)) {
      const packageName = specifier.slice('@stacksjs/'.length).split('/', 1)[0]!
      expect(path).toStartWith(`storage/framework/core/${packageName}/src/`)
    }
  })

  it('rejects built packages and another package source tree', () => {
    const modules = Object.fromEntries(STACKS_BENCHMARK_MODULES.map(specifier => [
      specifier,
      join(REPO_ROOT, 'storage', 'framework', 'core', specifier.slice('@stacksjs/'.length).split('/', 1)[0]!, 'src', 'index.ts'),
    ])) as StacksSourceModules
    modules['@stacksjs/router'] = join(REPO_ROOT, 'node_modules', '@stacksjs', 'router', 'dist', 'index.js')
    modules['@stacksjs/database'] = join(REPO_ROOT, 'storage', 'framework', 'core', 'router', 'src', 'index.ts')

    expect(stacksSourceIssues(REPO_ROOT, modules)).toHaveLength(2)
  })

  it('keeps benchmark-only implementations out of the Stacks fixture', () => {
    const source = readFileSync(join(import.meta.dir, 'servers', 'stacks.ts'), 'utf8')
    const specifiers = [...source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)].map(match => match[1]!)
    const stacksSpecifiers = [...new Set(specifiers.filter(specifier => specifier.startsWith('@stacksjs/')))].sort()

    expect(stacksSpecifiers).toEqual([...STACKS_FIXTURE_MODULES].sort())
    expect(specifiers).not.toContain('bun:sqlite')
    expect(source).not.toMatch(/@stacksjs\/[^'"]+\/src(?:\/|['"])/)
    expect(source).not.toContain('storage/framework/core')
    expect(source).not.toMatch(/\bBun\.serve\s*\(/)
    expect(source).not.toMatch(/\bnew\s+Response\s*\(/)
    expect(source).not.toMatch(/\bResponse\.json\s*\(/)
    expect(source).not.toMatch(/\bJSON\.stringify\s*\(/)
    expect(source).not.toMatch(/return\s+request\.getValidated\(\)/)
    expect(source).toContain('return { name: validated.name, count: validated.count }')
    expect(source).toContain('autoDiscoverRoutes: false')
    expect(source).toContain('disableViewRouting(router.bunRouter)')
    expect(source).not.toContain('._apiRoutesInitialized')
    expect(source).not.toContain('.routesFrom(')
  })

  it('keeps benchmark selectors out of framework source', () => {
    const filesWithBenchmarkSelectors: string[] = []
    const sourceGlob = new Bun.Glob('**/*.ts')

    for (const specifier of STACKS_BENCHMARK_MODULES) {
      const packageName = specifier.slice('@stacksjs/'.length).split('/', 1)[0]!
      const sourceRoot = join(REPO_ROOT, 'storage', 'framework', 'core', packageName, 'src')
      for (const file of sourceGlob.scanSync({ cwd: sourceRoot })) {
        const source = readFileSync(join(sourceRoot, file), 'utf8')
        if (/\bBENCH_[A-Z0-9_]+\b/.test(source))
          filesWithBenchmarkSelectors.push(`${packageName}/src/${file}`)
      }
    }

    expect(filesWithBenchmarkSelectors).toEqual([])
  })

  it('keeps peer database statements and result shaping equivalent', () => {
    for (const server of ['bun-raw.ts', 'elysia.ts', 'express.ts', 'fastify.ts', 'hono.ts']) {
      const source = readFileSync(join(import.meta.dir, 'servers', server), 'utf8')
      expect(source).toContain("SELECT id, name FROM bench_items WHERE id = 1 LIMIT 1")
      expect(source).toContain('id: row.id')
      expect(source).toContain('name: row.name')
    }
  })

  it('binds every benchmark server to the same loopback interface', () => {
    for (const server of ['bun-raw.ts', 'elysia.ts', 'express.ts', 'fastify.ts', 'hono.ts', 'stacks.ts']) {
      const source = readFileSync(join(import.meta.dir, 'servers', server), 'utf8')
      expect(source).toContain("const hostname = '127.0.0.1'")
      expect(source.match(/\bhostname\b/g)?.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('directs every peer fixture to the frozen comparison set', () => {
    for (const server of ['elysia.ts', 'express.ts', 'fastify.ts', 'hono.ts']) {
      const source = readFileSync(join(import.meta.dir, 'servers', server), 'utf8')
      expect(source).toContain('bun install --cwd bench/routing --frozen-lockfile')
      expect(source).not.toContain('bun add')
    }
  })
})
