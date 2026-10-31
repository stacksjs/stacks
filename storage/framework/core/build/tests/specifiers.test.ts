import { expect, test } from 'bun:test'
import { rewriteRelativeTsSpecifiers } from '../src/index'

test('relative .ts paths become the .js files a transpiled package holds, declaration paths stay', () => {
  const source = `import { a } from './a.ts'
export * from '../b.tsx'
const lazy = { path: './commands/deploy.ts' }
const manifest = { types: './dist/index.d.ts', glob: './dist/*.d.ts' }
import pkg from 'some-package/file.ts'`
  expect(rewriteRelativeTsSpecifiers(source)).toBe(`import { a } from './a.js'
export * from '../b.js'
const lazy = { path: './commands/deploy.js' }
const manifest = { types: './dist/index.d.ts', glob: './dist/*.d.ts' }
import pkg from 'some-package/file.ts'`)
})
