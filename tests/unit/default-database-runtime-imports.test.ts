import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('default application database imports', () => {
  it('reserves the database tooling barrel for migration operations', () => {
    const sourceRoot = join(import.meta.dir, '../../storage/framework/defaults/app')
    const transpiler = new Bun.Transpiler({ loader: 'ts' })
    const rootImports: string[] = []

    for (const file of new Bun.Glob('{Actions,Controllers}/**/*.ts').scanSync({ cwd: sourceRoot })) {
      const source = readFileSync(join(sourceRoot, file), 'utf8')
      if (transpiler.scanImports(source).some(dependency => dependency.path === '@stacksjs/database'))
        rootImports.push(file)
    }

    expect(rootImports.sort()).toEqual([
      'Actions/Dashboard/Operations/migration-operations.ts',
    ])
  })
})
