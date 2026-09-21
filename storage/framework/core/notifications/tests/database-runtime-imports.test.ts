import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('notification database imports', () => {
  it('keeps the database tooling barrel outside production modules', () => {
    const sourceRoot = join(import.meta.dir, '../src')
    const transpiler = new Bun.Transpiler({ loader: 'ts' })
    const rootImports: string[] = []

    for (const file of new Bun.Glob('**/*.ts').scanSync({ cwd: sourceRoot })) {
      const source = readFileSync(join(sourceRoot, file), 'utf8')
      for (const dependency of transpiler.scanImports(source)) {
        if (dependency.path === '@stacksjs/database')
          rootImports.push(`${file}: ${dependency.kind}`)
      }
    }

    expect(rootImports).toEqual([])
  })
})
