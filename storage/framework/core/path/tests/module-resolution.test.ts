import { afterEach, expect, test } from 'bun:test'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { resolveModulePath } from '../src/module-resolution'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

test('the actual defaults export contract resolves raw source after relocating an installed fixture', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-module-contract-'))
  roots.push(root)
  const original = join(root, 'original')
  const relocated = join(root, 'relocated app')
  const packageRoot = join(original, 'node_modules/@stacksjs/defaults')
  const exports = JSON.parse(readFileSync(resolve(import.meta.dir, '../../defaults/package.json'), 'utf8')).exports
  mkdirSync(join(packageRoot, 'app/Models'), { recursive: true })
  writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({ name: '@stacksjs/defaults', type: 'module', exports }))
  writeFileSync(join(packageRoot, 'app/Models/Probe.ts'), 'export default { marker: 42 }\n')
  cpSync(original, relocated, { recursive: true })
  rmSync(original, { recursive: true })
  const importer = join(relocated, 'storage/framework/auto-imports')
  mkdirSync(importer, { recursive: true })
  const target = resolveModulePath('@stacksjs/defaults/app/Models/Probe.ts', importer)
  expect(target.startsWith(realpathSync(relocated))).toBe(true)
  expect((await import(target)).default.marker).toBe(42)
  expect(() => resolveModulePath('@stacksjs/defaults/missing.ts', importer)).toThrow()
})

test('preserves relative and legacy bare-file registry entries', () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-module-local-'))
  roots.push(root)
  writeFileSync(join(root, 'local.ts'), 'export default {}\n')
  expect(resolveModulePath('./local.ts', root)).toBe(join(root, 'local.ts'))
  expect(resolveModulePath('local.ts', root)).toBe(join(root, 'local.ts'))
})
