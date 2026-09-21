import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const runtimeRoots = ['auctions', 'carts', 'coupons', 'gift-cards', 'orders', 'payments', 'products', 'shippings', 'tax', 'waitlists'] as const

describe('commerce database imports', () => {
  it('keeps the database tooling barrel outside migrated request paths', () => {
    const sourceRoot = join(import.meta.dir, '../src')
    const transpiler = new Bun.Transpiler({ loader: 'ts' })
    const rootImports: string[] = []

    for (const root of runtimeRoots) {
      for (const file of new Bun.Glob('**/*.ts').scanSync({ cwd: join(sourceRoot, root) })) {
        const source = readFileSync(join(sourceRoot, root, file), 'utf8')
        for (const dependency of transpiler.scanImports(source)) {
          if (dependency.path === '@stacksjs/database')
            rootImports.push(`${root}/${file}: ${dependency.kind}`)
        }
      }
    }

    expect(rootImports).toEqual([])
  })
})
