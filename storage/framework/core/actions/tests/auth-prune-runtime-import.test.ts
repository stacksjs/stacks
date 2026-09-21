import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('auth token pruning database imports', () => {
  it('keeps database tooling out of the runtime action', () => {
    const source = readFileSync(join(import.meta.dir, '../src/auth/prune.ts'), 'utf8')
    const dependencies = new Bun.Transpiler({ loader: 'ts' }).scanImports(source)

    expect(dependencies.some(dependency => dependency.path === '@stacksjs/database')).toBe(false)
    expect(dependencies.some(dependency => dependency.path === '@stacksjs/database/runtime')).toBe(true)
  })
})
