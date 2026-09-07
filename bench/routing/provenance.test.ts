import type { StacksSourceModules } from './provenance'
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO_ROOT } from './runtime'
import { resolveStacksSourceModules, STACKS_BENCHMARK_MODULES, stacksSourceIssues } from './provenance'

describe('Stacks benchmark source provenance', () => {
  it('resolves every framework dependency through its public entry point to source', () => {
    const modules = resolveStacksSourceModules(REPO_ROOT)
    expect(Object.keys(modules).sort()).toEqual([...STACKS_BENCHMARK_MODULES].sort())
    for (const [specifier, path] of Object.entries(modules)) {
      const packageName = specifier.slice('@stacksjs/'.length)
      expect(path).toStartWith(`storage/framework/core/${packageName}/src/`)
    }
  })

  it('rejects built packages and another package source tree', () => {
    const modules = Object.fromEntries(STACKS_BENCHMARK_MODULES.map(specifier => [
      specifier,
      join(REPO_ROOT, 'storage', 'framework', 'core', specifier.slice('@stacksjs/'.length), 'src', 'index.ts'),
    ])) as StacksSourceModules
    modules['@stacksjs/router'] = join(REPO_ROOT, 'node_modules', '@stacksjs', 'router', 'dist', 'index.js')
    modules['@stacksjs/database'] = join(REPO_ROOT, 'storage', 'framework', 'core', 'router', 'src', 'index.ts')

    expect(stacksSourceIssues(REPO_ROOT, modules)).toHaveLength(2)
  })

  it('keeps benchmark-only implementations out of the Stacks fixture', () => {
    const source = readFileSync(join(import.meta.dir, 'servers', 'stacks.ts'), 'utf8')
    const specifiers = [...source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)].map(match => match[1]!)
    const stacksSpecifiers = [...new Set(specifiers.filter(specifier => specifier.startsWith('@stacksjs/')))].sort()

    expect(stacksSpecifiers).toEqual([...STACKS_BENCHMARK_MODULES].sort())
    expect(specifiers).not.toContain('bun:sqlite')
    expect(source).not.toMatch(/@stacksjs\/[^'"]+\/src(?:\/|['"])/)
    expect(source).not.toContain('storage/framework/core')
  })
})
