import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageJson = JSON.parse(
  readFileSync(resolve('storage/framework/core/browser/package.json'), 'utf8'),
)
const composablesPackageJson = JSON.parse(
  readFileSync(resolve('storage/framework/core/composables/package.json'), 'utf8'),
)

describe('browser package contract', () => {
  // No `development` condition: it resolved to ./src/*, which is not published
  // (files is README + dist), so any consumer bundling these subpaths failed to
  // resolve them. Source resolution inside this repo comes from @stacksjs/alias.
  test('publishes resolvable typed composable and utility subpaths', () => {
    expect(packageJson.exports['./composables']).toEqual({
      types: './dist/composables/index.d.ts',
      bun: './dist/composables/index.js',
      import: './dist/composables/index.js',
      default: './dist/composables/index.js',
    })
    expect(packageJson.exports['./utils']).toEqual({
      types: './dist/utils/index.d.ts',
      bun: './dist/utils/index.js',
      import: './dist/utils/index.js',
      default: './dist/utils/index.js',
    })
    expect(packageJson.exports['./*'].types).toBe('./dist/*.d.ts')
    expect(packageJson.exports['./*'].development).toBeUndefined()
    expect(packageJson.exports['./*'].import).toBe('./dist/*.js')
    expect(composablesPackageJson.exports['./*'].types).toBe('./dist/*.d.ts')
    expect(composablesPackageJson.exports['./*'].development).toBeUndefined()
    expect(composablesPackageJson.exports['./*'].import).toBe('./dist/*.js')
  })

  test('keeps default browser functions on tree-shakeable subpaths', async () => {
    const glob = new Bun.Glob('**/*.ts')
    const files = await Array.fromAsync(glob.scan({
      cwd: resolve('storage/framework/defaults/functions'),
      absolute: true,
    }))
    const rootImports = files.filter(file =>
      /from\s+['"]@stacksjs\/browser['"]/.test(readFileSync(file, 'utf8')))

    expect(rootImports).toEqual([])
    expect(readFileSync(
      resolve('storage/framework/core/browser/src/composables/useStorage.ts'),
      'utf8',
    )).toContain(`from '@stacksjs/composables/useStorage'`)
    expect(readFileSync(
      resolve('storage/framework/core/browser/src/composables/useFetch.ts'),
      'utf8',
    )).toContain(`from '@stacksjs/composables/useFetch'`)
  })
})
