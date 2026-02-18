/**
 * Postinstall script to fix broken package declarations and missing source files.
 *
 * - bun-query-builder: npm package exports "bun" condition pointing to src/ which isn't shipped
 * - ts-mocker & bun-router: ship .d.ts files with parse errors that break tsc
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

// Fix bun-query-builder: create src/index.ts stub for "bun" export condition
const bqbSrc = join(root, 'node_modules/bun-query-builder/src')
if (!existsSync(bqbSrc)) {
  mkdirSync(bqbSrc, { recursive: true })
}
writeFileSync(join(bqbSrc, 'index.ts'), 'export * from "../dist/index.js"\n')

// Fix broken .d.ts files in ts-mocker and bun-router that have parse errors
const brokenDtsFiles = [
  'node_modules/ts-mocker/dist/locale-loader.d.ts',
  'node_modules/ts-mocker/dist/modules/database.d.ts',
  'node_modules/ts-mocker/dist/modules/git.d.ts',
  'node_modules/ts-mocker/dist/modules/image.d.ts',
  'node_modules/ts-mocker/dist/modules/internet.d.ts',
  'node_modules/ts-mocker/dist/utils/advanced-data.d.ts',
  'node_modules/@stacksjs/bun-router/dist/errors/error-handler.d.ts',
  'node_modules/@stacksjs/bun-router/dist/testing/websocket-testing.d.ts',
]

for (const file of brokenDtsFiles) {
  const fullPath = join(root, file)
  if (existsSync(fullPath)) {
    writeFileSync(fullPath, 'export {}\n')
  }
}

console.log('postinstall: patched broken package declarations')
